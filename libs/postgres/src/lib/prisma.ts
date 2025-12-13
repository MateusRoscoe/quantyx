import { PrismaClient } from '../generated/client';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { environment } from './env';

const globalForPrisma = global as unknown as {
  prisma: PrismaClient;
  pool: Pool;
};

function createPrismaClient() {
  // Create connection pool
  const pool = new Pool({
    connectionString: environment.POSTGRES_URL,
  });

  // Create adapter
  const adapter = new PrismaPg(pool);

  // Create Prisma Client with adapter
  return new PrismaClient({
    adapter,
    log: ['query', 'error', 'warn'],
  });
}

export const prisma = globalForPrisma.prisma || createPrismaClient();

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}

export async function disconnectPrisma() {
  await prisma.$disconnect();
}
