import { ClickHouseEvent } from '@quantyx/clickhouse';
import { getLogger } from '@quantyx/shared-backend';

import { environment } from '../helpers/env';
import { insertEventsToClickHouse } from '../models/clickhouse';
import { getAndConnectConsumer } from '../models/kafka';
import { EventService } from '../services/event-service';
import { initGeoService } from '../services/geo-service';

const logger = getLogger('app-ctrl');

export class AppCtrl {
  static async start() {
    await initGeoService();
    const consumer = await getAndConnectConsumer();

    await consumer.subscribe({
      topics: [environment.EVENT_TOPIC],
    });

    consumer.run({
      eachBatch: async ({ batch }) => {
        logger.info(
          `Starting batch processing from topic ${batch.topic} with ${batch.messages.length} messages`,
        );

        const validEvents: ClickHouseEvent[] = [];

        for (const message of batch.messages) {
          try {
            const event = JSON.parse(message.value?.toString() || '{}');
            validEvents.push(EventService.transformToClickHouseFormat(event));
          } catch (error) {
            logger.warn(
              {
                error,
                offset: message.offset,
                partition: batch.partition,
                topic: batch.topic,
              },
              'Skipping unparseable message',
            );
          }
        }

        // If this throws, the error propagates out of eachBatch.
        // The library seeks back and the batch is retried on the next poll.
        if (validEvents.length > 0) {
          await insertEventsToClickHouse(validEvents);
        }

        // Only reached if insert succeeded (or no valid events to insert).
        const lastMessage = batch.messages[batch.messages.length - 1];
        await consumer.commitOffsets([
          {
            topic: batch.topic,
            partition: batch.partition,
            offset: (parseInt(lastMessage.offset) + 1).toString(),
          },
        ]);

        logger.info(
          `Processed batch from topic ${batch.topic} with ${batch.messages.length} messages`,
        );
      },
    });
  }
}
