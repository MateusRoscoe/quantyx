import * as path from 'path';
import { FastifyInstance } from 'fastify';
import AutoLoad from '@fastify/autoload';
import { prisma } from '@quantyx/postgres';
import { getLogger } from '@quantyx/shared-backend';

const logger = getLogger('app');

/* eslint-disable-next-line */
export interface AppOptions {}

export async function app(fastify: FastifyInstance, opts: AppOptions) {
  prisma.$connect().catch((error: unknown) => {
    logger.error({ error }, 'Error connecting to Postgres');
  });

  fastify.register(AutoLoad, {
    dir: path.join(__dirname, 'plugins'),
    options: { ...opts },
  });

  fastify.register(AutoLoad, {
    dir: path.join(__dirname, 'routes'),
    options: { ...opts },
    ignorePattern: /.*\.spec\.ts$/,
  });
}
