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
import { getLogger, logger as baseLogger } from '@quantyx/shared-backend';
import { environment } from './app/helpers/env';
import { disconnectProducer } from './app/models/kafka';
import { disconnectRedis } from '@quantyx/redis';
import { prisma } from '@quantyx/postgres';

const logger = getLogger('main');

const host = environment.HOST ?? 'localhost';
const port = environment.PORT;

// Instantiate Fastify with some config
const server = Fastify({
  loggerInstance: baseLogger,
  disableRequestLogging: true,
}).withTypeProvider<ZodTypeProvider>();

// Custom request logging that silences 401 responses
server.addHook('onResponse', (request, reply, done) => {
  if (reply.statusCode !== 401) {
    request.log.info(
      { req: request, res: reply, responseTime: reply.elapsedTime },
      'request completed',
    );
  }
  done();
});

export type server = typeof server;

server.setValidatorCompiler(validatorCompiler);
server.setSerializerCompiler(serializerCompiler);

// Register your application as a normal plugin.

server.register(fastifySwagger, {
  openapi: {
    info: {
      title: 'Quantyx Event Webhook API',
      description:
        'API for ingesting event data via webhooks into Quantyx platform.',
      version: 'latest',
    },
    components: {
      securitySchemes: {
        apiKey: {
          type: 'apiKey',
          name: 'X-API-Key',
          in: 'header',
        },
      },
    },
    security: [{ apiKey: [] }],
  },
  transform: jsonSchemaTransform,
});

server.register(fastifySwaggerUI, {
  routePrefix: '/docs',
});

server.register(app);

// Start listening.
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
      await disconnectProducer();
      await disconnectRedis();
      await prisma.$disconnect();
      logger.info('Server closed gracefully.');
      process.exit(0);
    } catch (error) {
      logger.error(error, 'Error during server shutdown');
      process.exit(1);
    }
  });
}
