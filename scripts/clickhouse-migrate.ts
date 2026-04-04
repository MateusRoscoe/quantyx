/**
 * ClickHouse migration runner.
 *
 * Reads SQL files from infrastructure/clickhouse/migrations/ in order,
 * tracks applied migrations in analytics._migrations table,
 * and runs any new ones.
 *
 * Usage: npx tsx scripts/clickhouse-migrate.ts
 *
 * Each .sql file can contain multiple statements separated by semicolons.
 * Lines starting with -- are treated as comments.
 */

import { createClient } from '@clickhouse/client';
import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';

const MIGRATIONS_DIR = join(
  import.meta.dirname ?? __dirname,
  '../infrastructure/clickhouse/migrations',
);

function createClickHouseClient() {
  return createClient({
    url: process.env['CLICKHOUSE_URL'] ?? 'http://localhost:8123',
    username: process.env['CLICKHOUSE_USER'] ?? 'default',
    password: process.env['CLICKHOUSE_PASSWORD'] ?? '',
    database: process.env['CLICKHOUSE_DATABASE'] ?? 'analytics',
  });
}

async function ensureMigrationsTable(client: ReturnType<typeof createClient>) {
  await client.command({
    query: `
      CREATE TABLE IF NOT EXISTS _migrations (
        name String,
        applied_at DateTime DEFAULT now()
      ) ENGINE = MergeTree()
      ORDER BY name
    `,
  });
}

async function getAppliedMigrations(
  client: ReturnType<typeof createClient>,
): Promise<Set<string>> {
  const result = await client.query({
    query: 'SELECT name FROM _migrations ORDER BY name',
    format: 'JSONEachRow',
  });
  const rows = await result.json<{ name: string }>();
  return new Set(rows.map((r) => r.name));
}

function parseStatements(sql: string): string[] {
  return sql
    .split(';')
    .map((s) =>
      s
        .split('\n')
        .filter((line) => !line.trimStart().startsWith('--'))
        .join('\n')
        .trim(),
    )
    .filter((s) => s.length > 0);
}

async function main() {
  const client = createClickHouseClient();

  try {
    // Verify connection
    const ping = await client.ping();
    if (!ping.success) {
      console.error('Failed to connect to ClickHouse');
      process.exit(1);
    }
    console.log('Connected to ClickHouse');

    await ensureMigrationsTable(client);
    const applied = await getAppliedMigrations(client);

    // Read migration files
    const files = (await readdir(MIGRATIONS_DIR))
      .filter((f) => f.endsWith('.sql'))
      .sort();

    if (files.length === 0) {
      console.log('No migration files found');
      return;
    }

    const pending = files.filter((f) => !applied.has(f));

    if (pending.length === 0) {
      console.log(
        `All ${files.length} migration(s) already applied. Nothing to do.`,
      );
      return;
    }

    console.log(
      `Found ${pending.length} pending migration(s) out of ${files.length} total:\n`,
    );

    for (const file of pending) {
      console.log(`▶ Running ${file}...`);

      const sql = await readFile(join(MIGRATIONS_DIR, file), 'utf-8');
      const statements = parseStatements(sql);

      for (let i = 0; i < statements.length; i++) {
        const stmt = statements[i];
        try {
          await client.command({ query: stmt });
        } catch (err) {
          console.error(
            `\n✗ Failed on statement ${i + 1}/${statements.length} in ${file}:\n`,
          );
          console.error(stmt.slice(0, 200) + (stmt.length > 200 ? '...' : ''));
          console.error('\n', err instanceof Error ? err.message : String(err));
          process.exit(1);
        }
      }

      // Record migration as applied
      await client.insert({
        table: '_migrations',
        values: [{ name: file }],
        format: 'JSONEachRow',
      });

      console.log(
        `  ✓ Applied (${statements.length} statement${statements.length !== 1 ? 's' : ''})`,
      );
    }

    console.log(`\nDone. ${pending.length} migration(s) applied.`);
  } finally {
    await client.close();
  }
}

main().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
