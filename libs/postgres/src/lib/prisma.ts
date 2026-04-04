import { PrismaClient } from '../generated/client';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { environment } from './env';

const globalForPrisma = global as unknown as {
  prisma: PrismaClient;
  pool: Pool;
};

function createPrismaClient() {
  const pool = new Pool({
    connectionString: environment.POSTGRES_URL,
    max: environment.POSTGRES_POOL_MAX,
    idleTimeoutMillis: environment.POSTGRES_POOL_IDLE_TIMEOUT_MS,
    connectionTimeoutMillis: environment.POSTGRES_POOL_CONNECTION_TIMEOUT_MS,
  });

  const adapter = new PrismaPg(pool);

  return new PrismaClient({
    adapter,
    log:
      environment.POSTGRES_LOG_QUERIES === 'true'
        ? ['query', 'error', 'warn']
        : ['error', 'warn'],
  });
}

export const prisma = globalForPrisma.prisma || createPrismaClient();

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}

export async function disconnectPrisma() {
  await prisma.$disconnect();
}
