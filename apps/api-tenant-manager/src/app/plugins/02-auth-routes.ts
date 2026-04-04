import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import fp from 'fastify-plugin';
import { auth } from '@quantyx/auth';

export default fp(async function authRoutes(fastify: FastifyInstance) {
  fastify.all(
    '/api/auth/*',
    async (request: FastifyRequest, reply: FastifyReply) => {
      const url = `${request.protocol}://${request.hostname}${request.url}`;
      const headers = new Headers();
      for (const [key, value] of Object.entries(request.headers)) {
        if (value) {
          const values = Array.isArray(value) ? value : [value];
          for (const v of values) {
            headers.append(key, v);
          }
        }
      }

      const webRequest = new Request(url, {
        method: request.method,
        headers,
        body:
          request.method !== 'GET' && request.method !== 'HEAD'
            ? JSON.stringify(request.body)
            : undefined,
      });

      const response = await auth.handler(webRequest);

      reply.status(response.status);
      for (const [key, value] of response.headers.entries()) {
        reply.header(key, value);
      }
      const text = await response.text();
      return reply.send(text);
    },
  );
});
