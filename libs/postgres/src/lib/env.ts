import { z } from 'zod';

const envSchema = z.object({
  POSTGRES_URL: z.string().min(1),
  POSTGRES_POOL_MAX: z.coerce.number().int().min(1).default(10),
});

type Env = z.infer<typeof envSchema>;

export function validateEnv(): Env {
  const env = envSchema.parse(process.env);
  return env;
}

export const environment = validateEnv();
