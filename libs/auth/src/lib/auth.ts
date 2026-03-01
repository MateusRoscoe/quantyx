import { betterAuth } from 'better-auth';
import { prismaAdapter } from 'better-auth/adapters/prisma';
import { prisma } from '@quantyx/postgres';
import { createEmailTransport } from './email.js';
import { authEnvironment } from './env.js';

const emailTransport = createEmailTransport({
  host: authEnvironment.SMTP_HOST,
  port: authEnvironment.SMTP_PORT,
  secure: authEnvironment.SMTP_SECURE,
  auth: {
    user: authEnvironment.SMTP_USER,
    pass: authEnvironment.SMTP_PASS,
  },
  from: authEnvironment.SMTP_FROM,
});

export const auth = betterAuth({
  baseURL: authEnvironment.API_TENANT_MANAGER_EXTERNAL_URL,
  trustedOrigins: [authEnvironment.WEB_APP_URL],
  database: prismaAdapter(prisma, {
    provider: 'postgresql',
  }),
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: true,
    async sendResetPassword({ user, url }) {
      await emailTransport.sendEmail({
        to: user.email,
        subject: 'Reset your password',
        html: `<p>Click the link below to reset your password:</p><p><a href="${url}">${url}</a></p>`,
      });
    },
  },
  emailVerification: {
    sendOnSignUp: true,
    autoSignInAfterVerification: true,
    async sendVerificationEmail({ user, url }) {
      await emailTransport.sendEmail({
        to: user.email,
        subject: 'Verify your email address',
        html: `<p>Click the link below to verify your email:</p><p><a href="${url}">${url}</a></p>`,
      });
    },
  },
  experimental: {
    joins: true,
  },
  advanced: {
    database: {
      generateId: false,
    },
  },
});
