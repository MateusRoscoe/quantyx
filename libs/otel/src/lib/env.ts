import { z } from 'zod';

const booleanString = z
  .enum(['true', 'false', '1', '0'])
  .default('true')
  .transform((val) => val === 'true' || val === '1');

const envSchema = z.object({
  OTEL_ENABLED: booleanString,
  OTEL_TRACES_ENABLED: booleanString,
  OTEL_METRICS_ENABLED: booleanString,
  OTEL_LOGS_ENABLED: booleanString,
  OTEL_SERVICE_NAME: z.string().min(1).optional(),
  OTEL_EXPORTER_OTLP_ENDPOINT: z
    .string()
    .min(1)
    .default('http://localhost:4318'),
});

type Env = z.infer<typeof envSchema>;

export function validateEnv(): Env {
  return envSchema.parse(process.env);
}

export const environment = validateEnv();
