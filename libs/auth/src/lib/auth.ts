import { betterAuth } from 'better-auth';
import { prismaAdapter } from 'better-auth/adapters/prisma';
// If your Prisma file is located elsewhere, you can change the path
import { prisma } from '@quantyx/postgres';
import { createEmailTransport } from './email.js';

const emailTransport = createEmailTransport({
  host: process.env.SMTP_HOST ?? 'localhost',
  port: Number(process.env.SMTP_PORT ?? 587),
  secure: process.env.SMTP_SECURE === 'true',
  auth: {
    user: process.env.SMTP_USER ?? '',
    pass: process.env.SMTP_PASS ?? '',
  },
  from: process.env.SMTP_FROM ?? 'noreply@quantyx.io',
});

export const auth = betterAuth({
  baseURL: process.env.BETTER_AUTH_URL ?? 'http://localhost:3001',
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
