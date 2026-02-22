import { PostgreSqlContainer } from '@testcontainers/postgresql';
import { execSync } from 'child_process';
import * as path from 'path';

let container: Awaited<ReturnType<PostgreSqlContainer['start']>>;

export async function setup() {
  container = await new PostgreSqlContainer('postgres:18-trixie')
    .withDatabase('quantyx_test')
    .withUsername('postgres')
    .withPassword('postgres')
    .withStartupTimeout(60_000)
    .start();

  const connectionUri = container.getConnectionUri();

  // Prisma CLI reads DATABASE_URL; runtime adapter reads POSTGRES_URL
  process.env.DATABASE_URL = connectionUri;
  process.env.POSTGRES_URL = connectionUri;
  process.env.BETTER_AUTH_SECRET = 'test-secret-for-better-auth-at-least-32-chars';

  // Apply schema via migrations — run from libs/postgres so Prisma discovers prisma.config.ts
  const postgresLibPath = path.resolve(import.meta.dirname, '../../libs/postgres');
  execSync('pnpm exec prisma migrate deploy', {
    env: { ...process.env },
    cwd: postgresLibPath,
    stdio: 'inherit',
  });
}

export async function teardown() {
  await container?.stop();
}
