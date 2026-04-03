import * as path from 'path';
import { FastifyInstance } from 'fastify';
import AutoLoad from '@fastify/autoload';
import { prisma } from '@quantyx/postgres';
import { getLogger } from '@quantyx/shared-backend';

const logger = getLogger('app');

export async function app(fastify: FastifyInstance) {
  prisma.$connect().catch((error: unknown) => {
    logger.error({ error }, 'Error connecting to Postgres');
  });

  fastify.register(AutoLoad, {
    dir: path.join(__dirname, 'plugins'),
  });

  fastify.register(AutoLoad, {
    dir: path.join(__dirname, 'routes'),
    ignorePattern: /.*\.spec\.ts$/,
  });
}
