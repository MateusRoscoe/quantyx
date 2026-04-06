/**
 * Starts PostgreSQL + Mailpit Testcontainers, sets environment variables,
 * runs Prisma migrations, then launches Playwright. This ensures all env vars
 * are available before Playwright spawns the webServer processes.
 */
import { PostgreSqlContainer } from '@testcontainers/postgresql';
import { GenericContainer } from 'testcontainers';
import { execSync, spawnSync } from 'child_process';
import * as path from 'path';

const apiURL = 'http://localhost:3001';
const baseURL = 'http://localhost:3000';

async function main() {
  // Start PostgreSQL and Mailpit in parallel
  console.log('[e2e] Starting containers…');
  const [pgContainer, mailContainer] = await Promise.all([
    new PostgreSqlContainer('postgres:18-trixie')
      .withDatabase('quantyx_e2e')
      .withUsername('postgres')
      .withPassword('postgres')
      .withStartupTimeout(60_000)
      .start(),
    new GenericContainer('axllent/mailpit')
      .withExposedPorts(1025, 8025)
      .withStartupTimeout(30_000)
      .start(),
  ]);

  const connectionUri = pgContainer.getConnectionUri();
  const smtpPort = mailContainer.getMappedPort(1025);
  console.log(`[e2e] PostgreSQL ready at ${connectionUri}`);
  console.log(`[e2e] Mailpit SMTP on port ${smtpPort}`);

  const env: Record<string, string> = {
    ...(process.env as Record<string, string>),
    DATABASE_URL: connectionUri,
    POSTGRES_URL: connectionUri,
    BETTER_AUTH_SECRET: 'e2e-test-secret-for-better-auth-at-least-32-chars',
    API_TENANT_MANAGER_EXTERNAL_URL: apiURL,
    WEB_APP_URL: baseURL,
    SMTP_HOST: 'localhost',
    SMTP_PORT: String(smtpPort),
    SMTP_SECURE: 'false',
    SMTP_USER: 'test',
    SMTP_PASS: 'test',
    SMTP_FROM: 'test@quantyx.io',
  };

  // Apply Prisma migrations
  const postgresLibPath = path.resolve(__dirname, '../../../libs/postgres');
  console.log('[e2e] Running Prisma migrations…');
  execSync('pnpm exec prisma migrate deploy', {
    env,
    cwd: postgresLibPath,
    stdio: 'inherit',
  });

  // Run Playwright with all env vars inherited
  console.log('[e2e] Launching Playwright…');
  const args = process.argv.slice(2);
  const result = spawnSync('pnpm', ['exec', 'playwright', 'test', ...args], {
    env,
    cwd: __dirname,
    stdio: 'inherit',
  });

  // Cleanup
  console.log('[e2e] Stopping containers…');
  await Promise.all([pgContainer.stop(), mailContainer.stop()]);

  process.exit(result.status ?? 1);
}

main().catch((err) => {
  console.error('[e2e] Setup failed:', err);
  process.exit(1);
});
