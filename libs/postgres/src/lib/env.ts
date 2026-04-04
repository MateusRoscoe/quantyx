import { z } from 'zod';

const envSchema = z.object({
  POSTGRES_URL: z.string().min(1),
  POSTGRES_POOL_MAX: z.coerce.number().int().min(1).default(10),
  POSTGRES_POOL_IDLE_TIMEOUT_MS: z.coerce.number().int().min(0).default(30_000),
  POSTGRES_POOL_CONNECTION_TIMEOUT_MS: z.coerce
    .number()
    .int()
    .min(0)
    .default(5_000),
  POSTGRES_LOG_QUERIES: z.string().default('false'),
});

type Env = z.infer<typeof envSchema>;

export function validateEnv(): Env {
  const env = envSchema.parse(process.env);
  return env;
}

export const environment = validateEnv();
