import { environment } from '../helpers/env';
import { insertEventsToClickHouse } from '../models/clickhouse';
import { getAndConnectConsumer } from '../models/kafka';
import { EventService } from '../services/event-service';

import { getLogger } from '@quantyx/shared-backend';
const logger = getLogger('app-ctrl');

export class AppCtrl {
  static async start() {
    const consumer = await getAndConnectConsumer();

    await consumer.subscribe({
      topics: [environment.EVENT_TOPIC],
    });

    consumer.run({
      eachBatch: async ({ batch }) => {
        logger.info(
          `Starting batch processing from topic ${batch.topic} with ${batch.messages.length} messages`,
        );
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
            `Error processing batch from topic ${batch.topic}`,
          );
        } finally {
          logger.info(
            `Processed batch from topic ${batch.topic} with ${batch.messages.length} messages`,
          );
        }
      },
    });
  }
}
