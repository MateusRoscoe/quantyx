import { z } from 'zod';

const envSchema = z.object({
  REDIS_URL: z.string().min(1).default('redis://localhost:6379'),
});

type Env = z.infer<typeof envSchema>;

export function validateEnv(): Env {
  const env = envSchema.parse(process.env);
  return env;
}

export const environment = validateEnv();
