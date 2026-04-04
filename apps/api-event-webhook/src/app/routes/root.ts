import { FastifyInstance } from 'fastify';
import { connectProducer, getProducerStatus } from '../models/kafka';
import { environment } from '../helpers/env.js';
import { redisHealthCheck } from '@quantyx/redis';
import { prisma } from '@quantyx/postgres';

export default async function (fastify: FastifyInstance) {
  // Liveness — is the process running?
  // K8s livenessProbe: restart the pod if this fails.
  fastify.get('/healthz/live', async function (_request, reply) {
    reply.status(200).send({ status: 'ok' });
  });

  // Readiness — can it accept traffic?
  // K8s readinessProbe: stop routing requests if this fails.
  // Reports not-ready when too many sends are awaiting delivery.
  fastify.get('/healthz/ready', async function (_request, reply) {
    const { inFlightCount } = getProducerStatus();

    if (inFlightCount > environment.KAFKA_BACKPRESSURE_THRESHOLD) {
      reply.status(503).send({
        status: 'not ready',
        reason: 'producer backpressure',
        inFlightCount,
      });
      return;
    }

    reply.status(200).send({ status: 'ok', inFlightCount });
  });

  // Startup — have all dependencies connected?
  // K8s startupProbe: kill the pod if it can't connect on startup.
  fastify.get('/healthz/startup', async function (_request, reply) {
    const [kafkaResult, redisResult, pgResult] = await Promise.allSettled([
      connectProducer(),
      redisHealthCheck(),
      prisma.$queryRaw`SELECT 1`,
    ]);

    const status = {
      kafka:
        kafkaResult.status === 'fulfilled' ? 'connected' : 'disconnected',
      redis:
        redisResult.status === 'fulfilled' && redisResult.value.success
          ? 'connected'
          : 'disconnected',
      postgres:
        pgResult.status === 'fulfilled' ? 'connected' : 'disconnected',
    };

    const allHealthy = Object.values(status).every((s) => s === 'connected');

    if (!allHealthy) {
      reply.status(503).send({ status: 'unhealthy', dependencies: status });
      return;
    }

    reply.status(200).send({ status: 'ok', dependencies: status });
  });
}
