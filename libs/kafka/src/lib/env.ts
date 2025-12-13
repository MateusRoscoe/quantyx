import { z } from 'zod';

const envSchema = z
  .object({
    KAFKA_BROKERS: z.string().min(1),
    KAFKA_CLIENT_ID: z.string().min(1).default('api-event-webhook'),
    KAFKA_SSL_ENABLED: z
      .string()
      .transform((val) => val === 'true' || val === '1')
      .default(false),

    KAFKA_SASL_MECHANISM: z
      .enum(['plain', 'scram-sha-256', 'scram-sha-512', 'aws'])
      .optional(),
    KAFKA_SASL_USERNAME: z.string().min(1).optional(),
    KAFKA_SASL_PASSWORD: z.string().min(1).optional(),
  })
  .superRefine((data, ctx) => {
    if (data.KAFKA_SASL_MECHANISM) {
      if (!data.KAFKA_SASL_USERNAME) {
        ctx.addIssue({
          code: 'custom',
          message:
            'KAFKA_SASL_USERNAME is required when KAFKA_SASL_MECHANISM is set',
          path: ['KAFKA_SASL_USERNAME'],
        });
      }
      if (!data.KAFKA_SASL_PASSWORD) {
        ctx.addIssue({
          code: 'custom',
          message:
            'KAFKA_SASL_PASSWORD is required when KAFKA_SASL_MECHANISM is set',
          path: ['KAFKA_SASL_PASSWORD'],
        });
      }
    }
  });

type Env = z.infer<typeof envSchema>;

export function validateEnv(): Env {
  const env = envSchema.parse(process.env);
  return env;
}

export const environment = validateEnv();
