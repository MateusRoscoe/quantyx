import Fastify from 'fastify';
import fastifySwagger from '@fastify/swagger';
import fastifySwaggerUI from '@fastify/swagger-ui';
import { app } from './app/app';

import {
  jsonSchemaTransform,
  serializerCompiler,
  validatorCompiler,
  ZodTypeProvider,
} from 'fastify-type-provider-zod';
import { getLogger } from '@quantyx/shared-backend';
import { environment } from './helpers/env';
import { prisma } from '@quantyx/postgres';
import { disconnectRedis } from '@quantyx/redis';
import { disconnectProducer } from './app/models/kafka';
import { shutdownOtel } from '@quantyx/otel';

const logger = getLogger('main');

const host = environment.HOST;
const port = environment.PORT;

const server = Fastify({
  logger: { level: environment.LOG_LEVEL },
  trustProxy: environment.TRUST_PROXY,
  requestTimeout: environment.REQUEST_TIMEOUT_MS || undefined,
  keepAliveTimeout: environment.KEEP_ALIVE_TIMEOUT_MS,
}).withTypeProvider<ZodTypeProvider>();

export type server = typeof server;

server.setValidatorCompiler(validatorCompiler);
server.setSerializerCompiler(serializerCompiler);

server.register(fastifySwagger, {
  openapi: {
    info: {
      title: 'Quantyx Server Ingest API',
      description:
        'Server-side API for setting user/group properties and memberships.',
      version: 'latest',
    },
  },
  transform: jsonSchemaTransform,
});

server.register(fastifySwaggerUI, {
  routePrefix: '/docs',
});

server.register(app);

server.listen({ port, host }, (err) => {
  if (err) {
    server.log.error(err);
    process.exit(1);
  } else {
    logger.info(`[ ready ] http://${host}:${port}`);
    logger.info(`[ docs ] http://${host}:${port}/docs`);
  }
});

const SIGNALS = ['SIGINT', 'SIGTERM', 'SIGHUP'] as const;

for (const signal of SIGNALS) {
  process.on(signal, async () => {
    try {
      logger.info(`Received ${signal}, closing server...`);
      await server.close();
      await Promise.all([
        prisma.$disconnect(),
        disconnectRedis(),
        disconnectProducer(),
      ]);
      await shutdownOtel();
      logger.info('Server closed gracefully.');
      process.exit(0);
    } catch (error) {
      logger.error(error, 'Error during server shutdown');
      process.exit(1);
    }
  });
}
