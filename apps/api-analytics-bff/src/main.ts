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

const logger = getLogger('main');

const host = environment.HOST;
const port = environment.PORT;

const server = Fastify({
  logger: true,
}).withTypeProvider<ZodTypeProvider>();

export type server = typeof server;

server.setValidatorCompiler(validatorCompiler);
server.setSerializerCompiler(serializerCompiler);

server.register(fastifySwagger, {
  openapi: {
    info: {
      title: 'Quantyx Analytics BFF',
      description: 'Backend-for-frontend serving analytics data from ClickHouse.',
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
      await prisma.$disconnect();
      logger.info('Server closed gracefully.');
      process.exit(0);
    } catch (error) {
      logger.error(error, 'Error during server shutdown');
      process.exit(1);
    }
  });
}
