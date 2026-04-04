import { z } from 'zod';

const envSchema = z.object({
  API_TENANT_MANAGER_EXTERNAL_URL: z
    .string()
    .url()
    .default('http://localhost:3001')
    .describe(
      'Externally-reachable URL of api-tenant-manager; used by BetterAuth to build email verification and password reset links',
    ),
  WEB_APP_URL: z
    .string()
    .url()
    .default('http://localhost:3000')
    .describe(
      'URL of the frontend app; used as a trusted origin for Better Auth',
    ),
  BETTER_AUTH_SECRET: z.string().min(1),
  SMTP_HOST: z.string().min(1),
  SMTP_PORT: z.coerce.number().default(587),
  SMTP_SECURE: z
    .string()
    .default('false')
    .transform((v) => v === 'true'),
  SMTP_USER: z.string().min(1),
  SMTP_PASS: z.string().min(1),
  SMTP_FROM: z.string().min(1),
});

export const authEnvironment = envSchema.parse(process.env);
