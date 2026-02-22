import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z
    .enum(['development', 'production', 'test'])
    .default('development'),
  HOST: z.string().default('localhost'),
  PORT: z.coerce.number().default(3000),
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),

  EVENTS_MAX_BUFFER_SIZE: z.coerce.number().min(1).default(100),
  EVENTS_BUFFER_FLUSH_INTERVAL: z.coerce.number().min(1000).default(5000),
  EVENT_TOPIC: z.string().min(1).default('event-webhook-ingestion'),

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
