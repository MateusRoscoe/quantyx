import { betterAuth } from 'better-auth';
import { prismaAdapter } from 'better-auth/adapters/prisma';
// If your Prisma file is located elsewhere, you can change the path
import { prisma } from '@quantyx/postgres';

export const auth = betterAuth({
  database: prismaAdapter(prisma, {
    provider: 'postgresql',
  }),
  experimental: {
    joins: true,
  },
  advanced: {
    database: {
      generateId: false,
    },
  },
});
