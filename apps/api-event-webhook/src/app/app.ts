import * as path from 'path';
import { FastifyInstance } from 'fastify';
import AutoLoad from '@fastify/autoload';

import { connectProducer } from './models/kafka.js';
import { getLogger } from '@quantyx/shared-backend';
import { connectRedis } from '@quantyx/redis';
import { fastifyOtelPlugin } from '@quantyx/otel';

const logger = getLogger('app');

/* eslint-disable-next-line */
export interface AppOptions {}

export async function app(fastify: FastifyInstance, opts: AppOptions) {
  connectProducer().catch((error) => {
    logger.error('Error connecting Kafka producer:', error);
  });

  connectRedis().catch((error) => {
    logger.error('Error connecting Redis:', error);
  });

  fastify.register(fastifyOtelPlugin());

  fastify.register(AutoLoad, {
    dir: path.join(__dirname, 'plugins'),
    options: { ...opts },
  });

  // This loads all plugins defined in routes
  // define your routes in one of these
  fastify.register(AutoLoad, {
    dir: path.join(__dirname, 'routes'),
    options: { ...opts },
  });
}
