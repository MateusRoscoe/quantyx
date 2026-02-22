import type { FastifyInstance } from 'fastify';

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

  const setCookie = signUpResponse.headers['set-cookie'];
  const cookies = Array.isArray(setCookie) ? setCookie : [setCookie];
  const cookieHeader = cookies
    .filter(Boolean)
    .map((c) => (c as string).split(';')[0])
    .join('; ');

  const body = signUpResponse.json();

  return {
    headers: { cookie: cookieHeader },
    userId: body.user?.id ?? body.id,
    email,
  };
}
