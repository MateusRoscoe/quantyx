import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z
    .enum(['development', 'production', 'test'])
    .default('development'),
  HOST: z.string().default('localhost'),
  PORT: z.coerce.number().default(3004),
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
  DATABASE_URL: z.string().min(1),
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
