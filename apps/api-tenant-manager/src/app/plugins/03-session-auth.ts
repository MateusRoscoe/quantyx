import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import fp from 'fastify-plugin';
import { auth } from '@quantyx/auth';
import { fromNodeHeaders } from 'better-auth/node';

const PUBLIC_PATHS = new Set(['/healthz']);

function isPublic(url: string): boolean {
  if (PUBLIC_PATHS.has(url)) return true;
  if (url.startsWith('/docs')) return true;
  if (url.startsWith('/api/auth/')) return true;
  return false;
}

export default fp(async function sessionAuth(fastify: FastifyInstance) {
  fastify.decorateRequest('userId', '');
  fastify.decorateRequest('userEmail', '');
  fastify.decorateRequest('userName', '');

  fastify.addHook(
    'preHandler',
    async (request: FastifyRequest, reply: FastifyReply) => {
      if (isPublic(request.url)) return;

      const session = await auth.api.getSession({
        headers: fromNodeHeaders(request.headers),
      });

      if (!session) {
        return reply.unauthorized('Invalid or missing session');
      }

      request.userId = session.user.id;
      request.userEmail = session.user.email;
      request.userName = session.user.name;
    },
  );
});
