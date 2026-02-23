import cors from '@fastify/cors';
import fp from 'fastify-plugin';
import { environment } from '../../helpers/env.js';

export default fp(async function (fastify) {
  await fastify.register(cors, {
    origin: environment.WEB_APP_URL,
    credentials: true,
  });
});
