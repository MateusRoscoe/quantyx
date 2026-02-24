import { test as base, expect, type Page } from '@playwright/test';
import { prisma } from '@quantyx/postgres';

export interface TestUser {
  email: string;
  password: string;
  name: string;
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
  const dbUser = await prisma.user.findUniqueOrThrow({ where: { email } });
  await prisma.user.update({
    where: { id: dbUser.id },
    data: { emailVerified: true },
  });
  return dbUser.id;
}

async function deleteUserData(userId: string): Promise<void> {
  // Delete in dependency order
  await prisma.organizationMember.deleteMany({ where: { userId } });
  await prisma.session.deleteMany({ where: { userId } });
  await prisma.account.deleteMany({ where: { userId } });
  await prisma.user.delete({ where: { id: userId } });
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
