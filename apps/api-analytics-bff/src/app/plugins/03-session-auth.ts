import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import fp from 'fastify-plugin';
import { createHash } from 'node:crypto';
import { auth } from '@quantyx/auth';
import { redis } from '@quantyx/redis';
import { fromNodeHeaders } from 'better-auth/node';
import { environment } from '../../helpers/env';

const PUBLIC_PATHS = new Set(['/healthz']);

function isPublic(url: string): boolean {
  if (PUBLIC_PATHS.has(url)) return true;
  if (url.startsWith('/docs')) return true;
  return false;
}

interface CachedSession {
  userId: string;
  userEmail: string;
}

const CACHE_PREFIX = 'session:';
const ttl = environment.SESSION_CACHE_TTL_SECONDS;

function sessionCacheKey(cookie: string): string {
  return CACHE_PREFIX + createHash('sha256').update(cookie).digest('hex');
}

export default fp(async function sessionAuth(fastify: FastifyInstance) {
  fastify.decorateRequest('userId', '');
  fastify.decorateRequest('userEmail', '');

  fastify.addHook(
    'preHandler',
    async (request: FastifyRequest, reply: FastifyReply) => {
      if (isPublic(request.url)) return;

      const cookie = request.headers.cookie;

      // Try Redis cache first
      if (ttl > 0 && cookie) {
        const key = sessionCacheKey(cookie);
        try {
          const cached = await redis.get(key);
          if (cached) {
            const session: CachedSession = JSON.parse(cached);
            request.userId = session.userId;
            request.userEmail = session.userEmail;
            return;
          }
        } catch {
          // Cache miss or Redis error — fall through to auth
        }
      }

      const session = await auth.api.getSession({
        headers: fromNodeHeaders(request.headers),
      });

      if (!session) {
        return reply.unauthorized('Invalid or missing session');
      }

      request.userId = session.user.id;
      request.userEmail = session.user.email;

      // Cache in Redis (fire-and-forget)
      if (ttl > 0 && cookie) {
        const cached: CachedSession = {
          userId: session.user.id,
          userEmail: session.user.email,
        };
        redis
          .set(sessionCacheKey(cookie), JSON.stringify(cached), 'EX', ttl)
          .catch(() => void 0);
      }
    },
  );
});
