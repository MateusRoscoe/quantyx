import { z } from 'zod';

const envSchema = z.object({
  SCHEDULER_MODE: z.enum(['daemon', 'oneshot']).default('daemon'),
  SCHEDULER_INTERVAL_MS: z.coerce.number().min(60000).default(3600000),
  LOG_LEVEL: z.string().default('info'),
});

export const environment = envSchema.parse(process.env);
