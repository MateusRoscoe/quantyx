import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z
    .enum(['development', 'production', 'test'])
    .default('development'),
  HOST: z.string().default('localhost'),
  PORT: z.coerce.number().default(3002),
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),

  EVENTS_MAX_BUFFER_SIZE: z.coerce.number().min(1).default(2000),
  EVENTS_BUFFER_FLUSH_INTERVAL: z.coerce.number().min(1000).default(3000),
  EVENT_TOPIC: z.string().min(1).default('event-webhook-ingestion'),
  KAFKA_PRODUCER_ACKS: z.coerce.number().refine((v) => v === 0 || v === 1 || v === -1).default(1),
  EVENTS_BUFFER_CAPACITY_MULTIPLIER: z.coerce.number().min(2).default(20),

  POSTGRES_URL: z.string().min(1),
  REDIS_URL: z.string().min(1).default('redis://localhost:6379'),
  API_KEY_CACHE_TTL_SECONDS: z.coerce.number().min(1).default(300),
});

type Env = z.infer<typeof envSchema>;

export function validateEnv(): Env {
  const env = envSchema.parse(process.env);
  return env;
}

export const environment = validateEnv();
