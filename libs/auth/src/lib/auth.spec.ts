vi.mock('better-auth', () => ({
  betterAuth: vi.fn().mockReturnValue({ id: 'auth-instance' }),
}));

vi.mock('better-auth/adapters/prisma', () => ({
  prismaAdapter: vi.fn().mockReturnValue('prisma-adapter'),
}));

vi.mock('@quantyx/postgres', () => ({
  prisma: 'mock-prisma-client',
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
    expect(betterAuth).toHaveBeenCalledWith({
      database: 'prisma-adapter',
      experimental: { joins: true },
      advanced: { database: { generateId: false } },
    });
  });

  it('should export the auth instance', () => {
    expect(auth).toEqual({ id: 'auth-instance' });
  });
});
