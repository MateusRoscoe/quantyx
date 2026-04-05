import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import fp from 'fastify-plugin';
import { hashApiKey } from '@quantyx/shared-backend';
import { prisma } from '@quantyx/postgres';
import { redis } from '@quantyx/redis';
import { environment } from '../helpers/env.js';

const SKIP_PATHS = new Set(['/healthz/live', '/healthz/ready', '/healthz/startup', '/healthz/memory', '/docs', '/docs/']);

interface CachedKeyData {
  projectId: string;
  organizationId: string;
  expiresAt: string | null;
}

const NEGATIVE_CACHE_TTL_SECONDS = 60;

export default fp(async function apiKeyAuth(fastify: FastifyInstance) {
  fastify.decorateRequest('projectId', '');
  fastify.decorateRequest('organizationId', '');

  fastify.addHook(
    'onRequest',
    async (request: FastifyRequest, reply: FastifyReply) => {
      if (SKIP_PATHS.has(request.url) || request.url.startsWith('/docs/')) {
        return;
      }

      const apiKey = request.headers['x-api-key'] as string | undefined;
      if (!apiKey) {
        return reply.code(401).send({ statusCode: 401, error: 'Unauthorized', message: 'Missing X-API-Key header' });
      }

      const keyHash = hashApiKey(apiKey);
      const cacheKey = `apikey:${keyHash}`;

      // Check Redis cache first
      const cached = await redis.get(cacheKey);
      if (cached === 'NF') {
        return reply.code(401).send({ statusCode: 401, error: 'Unauthorized', message: 'Invalid API key' });
      }
      if (cached) {
        const data: CachedKeyData = JSON.parse(cached);

        if (data.expiresAt && new Date(data.expiresAt) < new Date()) {
          return reply.code(401).send({ statusCode: 401, error: 'Unauthorized', message: 'API key has expired' });
        }

        request.projectId = data.projectId;
        request.organizationId = data.organizationId;
        return;
      }

      // Fallback to PostgreSQL
      const record = await prisma.apiKey.findUnique({
        where: { keyHash },
        select: {
          id: true,
          projectId: true,
          organizationId: true,
          expiresAt: true,
          deletedAt: true,
        },
      });

      if (!record || record.deletedAt) {
        // Cache the negative lookup to prevent repeated DB hits
        redis
          .set(cacheKey, 'NF', 'EX', NEGATIVE_CACHE_TTL_SECONDS)
          .catch(() => {
            /* best-effort */
          });
        return reply.code(401).send({ statusCode: 401, error: 'Unauthorized', message: 'Invalid API key' });
      }

      if (record.expiresAt && record.expiresAt < new Date()) {
        return reply.code(401).send({ statusCode: 401, error: 'Unauthorized', message: 'API key has expired' });
      }

      // Cache the result
      const cacheData: CachedKeyData = {
        projectId: record.projectId,
        organizationId: record.organizationId,
        expiresAt: record.expiresAt?.toISOString() ?? null,
      };
      await redis.set(
        cacheKey,
        JSON.stringify(cacheData),
        'EX',
        environment.API_KEY_CACHE_TTL_SECONDS,
      );

      request.projectId = record.projectId;
      request.organizationId = record.organizationId;

      // Fire-and-forget lastUsedAt update
      prisma.apiKey
        .update({
          where: { id: record.id },
          data: { lastUsedAt: new Date() },
        })
        .catch(() => {
          /* fire-and-forget */
        });
    },
  );
});
