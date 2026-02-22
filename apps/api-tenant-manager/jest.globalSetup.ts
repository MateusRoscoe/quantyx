import { PostgreSqlContainer } from '@testcontainers/postgresql';
import { execSync } from 'child_process';
import * as path from 'path';

declare global {
  // eslint-disable-next-line no-var
  var __POSTGRES_CONTAINER__: Awaited<
    ReturnType<PostgreSqlContainer['start']>
  >;
}

export default async function () {
  const container = await new PostgreSqlContainer('postgres:18-trixie')
    .withDatabase('quantyx_test')
    .withUsername('postgres')
    .withPassword('postgres')
    .withStartupTimeout(60_000)
    .start();

  const connectionUri = container.getConnectionUri();

  // Prisma CLI reads DATABASE_URL; runtime adapter reads POSTGRES_URL
  process.env.DATABASE_URL = connectionUri;
  process.env.POSTGRES_URL = connectionUri;

  // Apply schema via migrations — run from libs/postgres so Prisma discovers prisma.config.ts
  const postgresLibPath = path.resolve(__dirname, '../../libs/postgres');
  execSync(`pnpm exec prisma migrate deploy`, {
    env: { ...process.env },
    cwd: postgresLibPath,
    stdio: 'inherit',
  });

  globalThis.__POSTGRES_CONTAINER__ = container;
}
