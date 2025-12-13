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
import { getLogger } from './app/helpers/logger';
import { environment } from './app/helpers/env';

const logger = getLogger('main');

const host = environment.HOST ?? 'localhost';
const port = environment.PORT;

// Instantiate Fastify with some config
const server = Fastify({
  logger: true,
}).withTypeProvider<ZodTypeProvider>();

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
