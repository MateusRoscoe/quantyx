import type { FastifyInstance } from 'fastify';
import { prisma } from '@quantyx/postgres';

export interface AuthContext {
  headers: Record<string, string>;
  userId: string;
  email: string;
}

export async function createAuthenticatedUser(
  server: FastifyInstance,
  email = 'test@example.com',
  password = 'Password123!',
  name = 'Test User',
): Promise<AuthContext> {
  // Sign up — with requireEmailVerification, no session is returned
  const signUpResponse = await server.inject({
    method: 'POST',
    url: '/api/auth/sign-up/email',
    payload: { email, password, name },
  });

  if (signUpResponse.statusCode !== 200) {
    throw new Error(
      `Failed to sign up test user: ${signUpResponse.statusCode} ${signUpResponse.body}`,
    );
  }

  const signUpBody = signUpResponse.json();
  const userId = signUpBody.user?.id ?? signUpBody.id;

  // Manually verify email so we can sign in
  await prisma.user.update({
    where: { id: userId },
    data: { emailVerified: true },
  });

  // Sign in to get a session cookie
  const signInResponse = await server.inject({
    method: 'POST',
    url: '/api/auth/sign-in/email',
    payload: { email, password },
  });

  if (signInResponse.statusCode !== 200) {
    throw new Error(
      `Failed to sign in test user: ${signInResponse.statusCode} ${signInResponse.body}`,
    );
  }

  const setCookie = signInResponse.headers['set-cookie'];
  const cookies = Array.isArray(setCookie) ? setCookie : [setCookie];
  const cookieHeader = cookies
    .filter(Boolean)
    .map((c) => (c as string).split(';')[0])
    .join('; ');

  return {
    headers: { cookie: cookieHeader },
    userId,
    email,
  };
}

export async function createOrgWithOwner(
  userId: string,
  name = 'Test Org',
) {
  return prisma.$transaction(async (tx) => {
    const org = await tx.organization.create({ data: { name } });
    await tx.organizationMember.create({
      data: {
        userId,
        organizationId: org.id,
        role: 'owner',
      },
    });
    return org;
  });
}
