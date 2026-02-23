vi.mock('better-auth', () => ({
  betterAuth: vi.fn().mockReturnValue({ id: 'auth-instance' }),
}));

vi.mock('better-auth/adapters/prisma', () => ({
  prismaAdapter: vi.fn().mockReturnValue('prisma-adapter'),
}));

vi.mock('@quantyx/postgres', () => ({
  prisma: 'mock-prisma-client',
}));

vi.mock('./email.js', () => ({
  createEmailTransport: vi.fn().mockReturnValue({
    sendEmail: vi.fn(),
  }),
}));

import { betterAuth } from 'better-auth';
import { prismaAdapter } from 'better-auth/adapters/prisma';
import { auth } from './auth';

describe('auth', () => {
  it('should create a prisma adapter with postgresql provider', () => {
    expect(prismaAdapter).toHaveBeenCalledWith('mock-prisma-client', {
      provider: 'postgresql',
    });
  });

  it('should create betterAuth with correct config', () => {
    expect(betterAuth).toHaveBeenCalledWith(
      expect.objectContaining({
        baseURL: expect.any(String),
        database: 'prisma-adapter',
        emailAndPassword: expect.objectContaining({
          enabled: true,
          requireEmailVerification: true,
          sendResetPassword: expect.any(Function),
        }),
        emailVerification: expect.objectContaining({
          sendOnSignUp: true,
          autoSignInAfterVerification: true,
          sendVerificationEmail: expect.any(Function),
        }),
        experimental: { joins: true },
        advanced: { database: { generateId: false } },
      }),
    );
  });

  it('should export the auth instance', () => {
    expect(auth).toEqual({ id: 'auth-instance' });
  });
});
