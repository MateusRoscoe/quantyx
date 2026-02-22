import { FastifyInstance } from 'fastify';
import { connectProducer } from '../models/kafka';
import { redisHealthCheck } from '@quantyx/redis';
import { prisma } from '@quantyx/postgres';

export default async function (fastify: FastifyInstance) {
  fastify.get('/healthz', async function () {
    const [connectKafka, redisResult, pgResult] = await Promise.allSettled([
      connectProducer(),
      redisHealthCheck(),
      prisma.$queryRaw`SELECT 1`,
    ]);

    const response = {
      kafka: connectKafka.status === 'fulfilled' ? 'connected' : 'disconnected',
      redis:
        redisResult.status === 'fulfilled' && redisResult.value.success
          ? 'connected'
          : 'disconnected',
      postgres: pgResult.status === 'fulfilled' ? 'connected' : 'disconnected',
    };

    return { message: 'Alive', status: response };
  });
}
