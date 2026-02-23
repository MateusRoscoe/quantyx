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

vi.mock('./env.js', () => ({
  authEnvironment: {
    API_TENANT_MANAGER_EXTERNAL_URL: 'http://localhost:3001',
    BETTER_AUTH_SECRET: 'test-secret',
    SMTP_HOST: 'smtp.example.com',
    SMTP_PORT: 587,
    SMTP_SECURE: false,
    SMTP_USER: 'user',
    SMTP_PASS: 'pass',
    SMTP_FROM: 'noreply@example.com',
  },
}));

import { betterAuth } from 'better-auth';
import { prismaAdapter } from 'better-auth/adapters/prisma';
import { createEmailTransport } from './email.js';
import { auth } from './auth';

describe('auth', () => {
  it('should create email transport with validated env config', () => {
    expect(createEmailTransport).toHaveBeenCalledWith({
      host: 'smtp.example.com',
      port: 587,
      secure: false,
      auth: { user: 'user', pass: 'pass' },
      from: 'noreply@example.com',
    });
  });

  it('should create a prisma adapter with postgresql provider', () => {
    expect(prismaAdapter).toHaveBeenCalledWith('mock-prisma-client', {
      provider: 'postgresql',
    });
  });

  it('should create betterAuth with correct config', () => {
    expect(betterAuth).toHaveBeenCalledWith(
      expect.objectContaining({
        baseURL: 'http://localhost:3001',
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
