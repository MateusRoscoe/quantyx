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
  KAFKA_SESSION_TIMEOUT_MS: z.number().min(10000).default(30000),
});

type Env = z.infer<typeof envSchema>;

export function validateEnv(): Env {
  const env = envSchema.parse(process.env);
  return env;
}

export const environment = validateEnv();
