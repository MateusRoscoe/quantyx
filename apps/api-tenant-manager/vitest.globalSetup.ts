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
  process.env.BETTER_AUTH_SECRET =
    'test-secret-for-better-auth-at-least-32-chars';
  process.env.API_TENANT_MANAGER_EXTERNAL_URL = 'http://localhost:3001';
  process.env.SMTP_HOST = 'localhost';
  process.env.SMTP_PORT = '1025';
  process.env.SMTP_SECURE = 'false';
  process.env.SMTP_USER = 'test';
  process.env.SMTP_PASS = 'test';
  process.env.SMTP_FROM = 'test@quantyx.io';

  // Apply schema via migrations — run from libs/postgres so Prisma discovers prisma.config.ts
  const postgresLibPath = path.resolve(
    import.meta.dirname,
    '../../libs/postgres',
  );
  execSync('pnpm exec prisma migrate deploy', {
    env: { ...process.env },
    cwd: postgresLibPath,
    stdio: 'inherit',
  });
}

export async function teardown() {
  await container?.stop();
}
