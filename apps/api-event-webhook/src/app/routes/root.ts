import { FastifyInstance } from 'fastify';
import { connectProducer, getBufferStatus } from '../models/kafka';
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
  // Fails when the event buffer is at capacity.
  fastify.get('/healthz/ready', async function (_request, reply) {
    const bufferStatus = getBufferStatus();
    const isReady = bufferStatus.size < bufferStatus.capacity;

    if (!isReady) {
      reply.status(503).send({
        status: 'not ready',
        reason: 'event buffer is full',
        buffer: bufferStatus,
      });
      return;
    }

    reply.status(200).send({ status: 'ok', buffer: bufferStatus });
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
