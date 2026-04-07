import { FastifyInstance } from 'fastify';
import { connectProducer } from '../models/kafka';
import { redisHealthCheck } from '@quantyx/redis';
import { prisma } from '@quantyx/postgres';

export default async function (fastify: FastifyInstance) {
  // Liveness — is the process running?
  // K8s livenessProbe: restart the pod if this fails.
  fastify.get('/healthz/live', async function (_request, reply) {
    reply.status(200).send({ status: 'ok' });
  });

  // Readiness — can it accept traffic?
  // K8s readinessProbe: backpressure is handled at produce-time via Queue full error.
  fastify.get('/healthz/ready', async function (_request, reply) {
    reply.status(200).send({ status: 'ok' });
  });

  // Memory diagnostics
  fastify.get('/healthz/memory', async function (_request, reply) {
    const mem = process.memoryUsage();
    reply.status(200).send({
      rss_mb: Math.round(mem.rss / 1048576),
      heap_total_mb: Math.round(mem.heapTotal / 1048576),
      heap_used_mb: Math.round(mem.heapUsed / 1048576),
      external_mb: Math.round(mem.external / 1048576),
      array_buffers_mb: Math.round(mem.arrayBuffers / 1048576),
      native_mb: Math.round((mem.rss - mem.heapTotal - mem.external) / 1048576),
    });
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
      kafka: kafkaResult.status === 'fulfilled' ? 'connected' : 'disconnected',
      redis:
        redisResult.status === 'fulfilled' && redisResult.value.success
          ? 'connected'
          : 'disconnected',
      postgres: pgResult.status === 'fulfilled' ? 'connected' : 'disconnected',
    };

    const allHealthy = Object.values(status).every((s) => s === 'connected');

    if (!allHealthy) {
      reply.status(503).send({ status: 'unhealthy', dependencies: status });
      return;
    }

    reply.status(200).send({ status: 'ok', dependencies: status });
  });
}
