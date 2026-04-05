import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z
    .enum(['development', 'production', 'test'])
    .default('development'),
  HOST: z.string().default('localhost'),
  PORT: z.coerce.number().default(3002),
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),

  EVENT_TOPIC: z.string().min(1).default('event-webhook-ingestion'),
  KAFKA_PRODUCER_ACKS: z.coerce.number().refine((v) => v === 0 || v === 1 || v === -1).default(1),
  KAFKA_LINGER_MS: z.coerce.number().min(0).default(100),
  KAFKA_BATCH_SIZE: z.coerce.number().min(1).default(1048576),
  KAFKA_BACKPRESSURE_THRESHOLD: z.coerce.number().min(1).default(50000),

  POSTGRES_URL: z.string().min(1),
  REDIS_URL: z.string().min(1).default('redis://localhost:6379'),
  API_KEY_CACHE_TTL_SECONDS: z.coerce.number().min(1).default(300),

  GC_MESSAGE_THRESHOLD: z.coerce.number().min(0).default(10000),
  GC_INTERVAL_MS: z.coerce.number().min(0).default(5000),

  // When true, the API accepts ip_address and user_agent from the request body
  // instead of inferring them from the HTTP request. For testing/seeding only.
  ALLOW_CLIENT_IP_AND_UA: z
    .enum(['true', 'false', '1', '0'])
    .default('false')
    .transform((v) => v === 'true' || v === '1'),
});

type Env = z.infer<typeof envSchema>;

export function validateEnv(): Env {
  const env = envSchema.parse(process.env);
  return env;
}

export const environment = validateEnv();
