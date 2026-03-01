import { test as base, expect, type Page } from '@playwright/test';
import pg from 'pg';

const { Pool } = pg;

export interface TestUser {
  email: string;
  password: string;
  name: string;
}

function getPool() {
  return new Pool({ connectionString: process.env.DATABASE_URL });
}

/**
 * Register a user through the real UI, then verify their email directly
 * in the database (same pattern as api-tenant-manager test-utils).
 */
async function registerUser(page: Page, user: TestUser): Promise<void> {
  await page.goto('/register');
  await page.getByLabel('Name').fill(user.name);
  await page.getByLabel('Email').fill(user.email);
  await page.getByLabel('Password').fill(user.password);
  await page.getByRole('button', { name: 'Create account' }).click();

  // Wait for redirect to verify-email page
  await expect(page).toHaveURL('/verify-email');
}

async function verifyEmailInDb(email: string): Promise<string> {
  const pool = getPool();
  try {
    const { rows } = await pool.query(
      'SELECT id FROM "user" WHERE email = $1',
      [email],
    );
    if (rows.length === 0) throw new Error(`User not found: ${email}`);
    const userId = rows[0].id;
    await pool.query(
      'UPDATE "user" SET "emailVerified" = true WHERE id = $1',
      [userId],
    );
    return userId;
  } finally {
    await pool.end();
  }
}

async function deleteUserData(userId: string): Promise<void> {
  const pool = getPool();
  try {
    // Delete in dependency order
    await pool.query(
      'DELETE FROM "organization_members" WHERE "userId" = $1',
      [userId],
    );
    await pool.query('DELETE FROM "session" WHERE "userId" = $1', [userId]);
    await pool.query('DELETE FROM "account" WHERE "userId" = $1', [userId]);
    await pool.query('DELETE FROM "user" WHERE id = $1', [userId]);
  } finally {
    await pool.end();
  }
}

type Fixtures = {
  createVerifiedUser: (overrides?: Partial<TestUser>) => Promise<TestUser>;
};

export const test = base.extend<Fixtures>({
  createVerifiedUser: async ({ page }, use) => {
    const createdUserIds: string[] = [];

    const factory = async (overrides: Partial<TestUser> = {}): Promise<TestUser> => {
      const user: TestUser = {
        name: overrides.name ?? 'E2E Test User',
        email: overrides.email ?? `e2e-${Date.now()}@test.quantyx.io`,
        password: overrides.password ?? 'TestPassword123!',
      };

      await registerUser(page, user);
      const userId = await verifyEmailInDb(user.email);
      createdUserIds.push(userId);

      return user;
    };

    await use(factory);

    // Cleanup: remove all users created during the test
    for (const userId of createdUserIds) {
      await deleteUserData(userId).catch(() => {
        // Best-effort cleanup — user may have been deleted by test
      });
    }
  },
});

export { expect } from '@playwright/test';
