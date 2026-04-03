import type { FastifyInstance } from 'fastify';
import fp from 'fastify-plugin';
import cors from '@fastify/cors';
import { environment } from '../../helpers/env';

export default fp(async function corsPlugin(fastify: FastifyInstance) {
  fastify.register(cors, {
    origin: environment.WEB_APP_URL,
    credentials: true,
  });
});
