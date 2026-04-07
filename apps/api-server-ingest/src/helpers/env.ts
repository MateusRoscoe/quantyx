import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z
    .enum(['development', 'production', 'test'])
    .default('development'),
  HOST: z.string().default('localhost'),
  PORT: z.coerce.number().default(3005),
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),

  EVENT_TOPIC: z.string().min(1).default('event-webhook-ingestion'),
  KAFKA_PRODUCER_ACKS: z.coerce
    .number()
    .refine((v) => v === 0 || v === 1 || v === -1)
    .default(1),
  KAFKA_LINGER_MS: z.coerce.number().min(0).default(100),
  KAFKA_BATCH_SIZE: z.coerce.number().min(1).default(1048576),
  KAFKA_BACKPRESSURE_THRESHOLD: z.coerce.number().min(1).default(50000),
  KAFKA_QUEUE_BUFFERING_MAX_KB: z.coerce.number().min(1).default(262144),

  DATABASE_URL: z.string().min(1),
  REDIS_URL: z.string().min(1).default('redis://localhost:6379'),
  WEB_APP_URL: z.string().url().default('http://localhost:3000'),

  TRUST_PROXY: z
    .enum(['true', 'false'])
    .default('false')
    .transform((v) => v === 'true'),
  REQUEST_TIMEOUT_MS: z.coerce.number().int().min(0).default(0),
  KEEP_ALIVE_TIMEOUT_MS: z.coerce.number().int().min(0).default(72_000),
  SESSION_CACHE_TTL_SECONDS: z.coerce.number().int().min(0).default(60),
});

type Env = z.infer<typeof envSchema>;

export function validateEnv(): Env {
  return envSchema.parse(process.env);
}

export const environment = validateEnv();
