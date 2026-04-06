import { z } from 'zod';

const booleanString = z
  .string()
  .default('false')
  .transform((val) => val === '1' || val === 'true');

const envSchema = z.object({
  CLICKHOUSE_URL: z.url().default('http://localhost:8123'),
  CLICKHOUSE_USER: z.string().min(1).default('default'),
  CLICKHOUSE_PASSWORD: z.string().default(''),
  CLICKHOUSE_DATABASE: z.string().min(1).default('analytics'),
  CLICKHOUSE_REQUEST_TIMEOUT_MS: z
    .string()
    .transform((val) => parseInt(val, 10))
    .default(30000),
  CLICKHOUSE_ASYNC_INSERT: booleanString,
  CLICKHOUSE_WAIT_FOR_ASYNC_INSERT: booleanString,
  CLICKHOUSE_ASYNC_INSERT_DEDUPLICATE: booleanString,
});

type Env = z.infer<typeof envSchema>;

export function validateEnv(): Env {
  const env = envSchema.parse(process.env);
  return env;
}

export const environment = validateEnv();
