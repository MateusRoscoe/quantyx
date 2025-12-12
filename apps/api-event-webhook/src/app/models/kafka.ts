import { Kafka } from 'kafkajs';

import { CompressionTypes, CompressionCodecs } from 'kafkajs';
import LZ4 from 'kafkajs-lz4';

CompressionCodecs[CompressionTypes.LZ4] = new LZ4().codec;

const kafka = new Kafka({
  clientId: 'my-app',
  brokers: ['kafka1:9092', 'kafka2:9092'],
});

const producer = kafka.producer();

export async function connectProducer() {
  await producer.connect();
}

export async function disconnectProducer() {
  await producer.disconnect();
}

export async function sendMessage(
  topic: string,
  messages: Array<{ key: string; value: string }>
) {
  await producer.send({
    topic,
    messages,
    compression: CompressionTypes.LZ4,
  });
}
