import { KafkaJS } from '@confluentinc/kafka-javascript';

import { environment } from './env';

const baseConfig: Record<string, unknown> = {
  'client.id': environment.KAFKA_CLIENT_ID,
  'bootstrap.servers': environment.KAFKA_BROKERS,
};

if (environment.KAFKA_SASL_MECHANISM) {
  baseConfig['security.protocol'] = environment.KAFKA_SSL_ENABLED
    ? 'SASL_SSL'
    : 'SASL_PLAINTEXT';
  baseConfig['sasl.mechanism'] =
    environment.KAFKA_SASL_MECHANISM.toUpperCase();
  baseConfig['sasl.username'] = environment.KAFKA_SASL_USERNAME;
  baseConfig['sasl.password'] = environment.KAFKA_SASL_PASSWORD;
} else if (environment.KAFKA_SSL_ENABLED) {
  baseConfig['security.protocol'] = 'SSL';
}

const kafka = new KafkaJS.Kafka();

export function createProducer(config?: Record<string, unknown>) {
  return kafka.producer({ ...baseConfig, ...config });
}

export function createConsumer(config: Record<string, unknown>) {
  return kafka.consumer({ ...baseConfig, ...config });
}

export function createAdmin(config?: Record<string, unknown>) {
  return kafka.admin({ ...baseConfig, ...config });
}
