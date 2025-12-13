import { FastifyInstance } from 'fastify';
import { connectProducer } from '../models/kafka';

export default async function (fastify: FastifyInstance) {
  fastify.get('/healthz', async function () {
    const [connectKafka] = await Promise.allSettled([connectProducer()]);

    const response = {
      kafka: connectKafka.status === 'fulfilled' ? 'connected' : 'disconnected',
    };

    return { message: 'Alive', status: response };
  });
}
