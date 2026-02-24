import { PostgreSqlContainer } from '@testcontainers/postgresql';
import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

const STATE_FILE = path.join(__dirname, '.e2e-state.json');

export default async function globalSetup() {
  const container = await new PostgreSqlContainer('postgres:18-trixie')
    .withDatabase('quantyx_e2e')
    .withUsername('postgres')
    .withPassword('postgres')
    .withStartupTimeout(60_000)
    .start();

  const connectionUri = container.getConnectionUri();

  // Prisma CLI reads DATABASE_URL; runtime adapter reads POSTGRES_URL
  process.env.DATABASE_URL = connectionUri;
  process.env.POSTGRES_URL = connectionUri;
  process.env.BETTER_AUTH_SECRET =
    'e2e-test-secret-for-better-auth-at-least-32-chars';
  process.env.API_TENANT_MANAGER_EXTERNAL_URL = 'http://localhost:3001';
  process.env.WEB_APP_URL = 'http://localhost:3000';
  process.env.SMTP_HOST = 'localhost';
  process.env.SMTP_PORT = '1025';
  process.env.SMTP_SECURE = 'false';
  process.env.SMTP_USER = 'test';
  process.env.SMTP_PASS = 'test';
  process.env.SMTP_FROM = 'test@quantyx.io';

  // Apply schema via Prisma migrations
  const postgresLibPath = path.resolve(__dirname, '../../../libs/postgres');
  execSync('pnpm exec prisma migrate deploy', {
    env: { ...process.env },
    cwd: postgresLibPath,
    stdio: 'inherit',
  });

  // Persist container ID so teardown can stop it
  fs.writeFileSync(
    STATE_FILE,
    JSON.stringify({
      containerId: container.getId(),
      connectionUri,
    }),
  );
}
