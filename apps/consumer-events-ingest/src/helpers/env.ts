import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z
    .enum(['development', 'production', 'test'])
    .default('development'),
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),

  EVENT_TOPIC: z.string().min(1).default('event-webhook-ingestion'),
  KAFKA_CONSUMER_GROUP_ID: z
    .string()
    .min(1)
    .default('consumer-events-ingest-group'),
  KAFKA_CONSUME_FROM_BEGINNING: z
    .string()
    .transform((val) => val === 'true')
    .default(false),
  KAFKA_SESSION_TIMEOUT_MS: z.coerce.number().min(10000).default(30000),
  KAFKA_FETCH_MIN_BYTES: z.coerce.number().min(1).default(262144),
  KAFKA_FETCH_WAIT_MAX_MS: z.coerce.number().min(1).default(5000),
  KAFKA_MAX_BATCH_SIZE: z.coerce.number().min(-1).default(25000),
});

type Env = z.infer<typeof envSchema>;

export function validateEnv(): Env {
  const env = envSchema.parse(process.env);
  return env;
}

export const environment = validateEnv();
