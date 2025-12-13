import { Kafka, SASLOptions } from 'kafkajs';

import { environment } from './env';

export const kafka = new Kafka({
  clientId: environment.KAFKA_CLIENT_ID,
  brokers: environment.KAFKA_BROKERS.split(','),
  ssl: environment.KAFKA_SSL_ENABLED,
  sasl: environment.KAFKA_SASL_MECHANISM
    ? ({
        mechanism: environment.KAFKA_SASL_MECHANISM,
        username: environment.KAFKA_SASL_USERNAME,
        password: environment.KAFKA_SASL_PASSWORD,
      } as SASLOptions)
    : undefined,
});
