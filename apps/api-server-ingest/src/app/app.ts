import * as path from 'path';
import { FastifyInstance } from 'fastify';
import AutoLoad from '@fastify/autoload';
import { prisma } from '@quantyx/postgres';
import { connectRedis } from '@quantyx/redis';
import { getLogger } from '@quantyx/shared-backend';
import { fastifyOtelPlugin } from '@quantyx/otel';
import { connectProducer } from './models/kafka';

const logger = getLogger('app');

export async function app(fastify: FastifyInstance) {
  prisma.$connect().catch((error: unknown) => {
    logger.error({ error }, 'Error connecting to Postgres');
  });

  connectRedis().catch((error: unknown) => {
    logger.error({ error }, 'Error connecting to Redis');
  });

  connectProducer().catch((error: unknown) => {
    logger.error({ error }, 'Error connecting to Kafka producer');
  });

  fastify.register(fastifyOtelPlugin());

  fastify.register(AutoLoad, {
    dir: path.join(__dirname, 'plugins'),
  });

  fastify.register(AutoLoad, {
    dir: path.join(__dirname, 'routes'),
    ignorePattern: /.*\.spec\.ts$/,
  });
}
