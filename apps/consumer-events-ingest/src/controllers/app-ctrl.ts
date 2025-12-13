import { environment } from '../helpers/env';
import { getAndConnectConsumer } from '../models/kafka';

export class AppCtrl {
  static async start() {
    const consumer = await getAndConnectConsumer();

    consumer.subscribe({
      topic: environment.EVENT_TOPIC,
      fromBeginning: environment.KAFKA_CONSUME_FROM_BEGINNING,
    });

    consumer.run({
      eachBatch: async ({ batch }) => {
        for (const message of batch.messages) {
          // Process each message
          console.log({
            partition: batch.partition,
            offset: message.offset,
            value: message.value?.toString(),
          });
        }
      },
    });
  }
}
