import { environment } from '../helpers/env';
import { insertEventsToClickHouse } from '../models/clickhouse';
import { getAndConnectConsumer } from '../models/kafka';
import { EventService } from '../services/event-service';

import { getLogger } from '@quantyx/shared-backend';
const logger = getLogger('app-ctrl');

export class AppCtrl {
  static async start() {
    const consumer = await getAndConnectConsumer();

    consumer.subscribe({
      topic: environment.EVENT_TOPIC,
      fromBeginning: environment.KAFKA_CONSUME_FROM_BEGINNING,
    });

    consumer.run({
      autoCommit: false,
      eachBatch: async ({ batch, heartbeat }) => {
        logger.info(
          `Starting batch processing from topic ${batch.topic} with ${batch.messages.length} messages`
        );
        const heartbeatInterval = setInterval(async () => {
          await heartbeat();
        }, Math.floor(environment.KAFKA_SESSION_TIMEOUT_MS / 3)); // 3 heartbeats per session timeout to be safe
        try {
          const events = batch.messages.map((message) => {
            const event = JSON.parse(message.value?.toString() || '{}');
            return EventService.transformToClickHouseFormat(event);
          });

          await insertEventsToClickHouse(events);

          const lastMessage = batch.messages[batch.messages.length - 1];
          await consumer.commitOffsets([
            {
              topic: batch.topic,
              partition: batch.partition,
              offset: (parseInt(lastMessage.offset) + 1).toString(),
            },
          ]);
        } catch (error) {
          logger.error(
            error,
            `Error processing batch from topic ${batch.topic}`
          );
        } finally {
          logger.info(
            `Processed batch from topic ${batch.topic} with ${batch.messages.length} messages`
          );
          if (heartbeatInterval) {
            clearInterval(heartbeatInterval);
          }
        }
      },
    });
  }
}
