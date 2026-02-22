import { prisma } from '@quantyx/postgres';
import type { server } from '../../main';

export default async function (fastify: server) {
  fastify.get('/healthz', async () => {
    const [db] = await Promise.allSettled([prisma.$queryRaw`SELECT 1`]);
    return {
      status: 'alive',
      db: db.status === 'fulfilled' ? 'connected' : 'disconnected',
    };
  });
}
