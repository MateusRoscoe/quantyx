import { test, expect } from './fixtures';

test.describe('Auth', () => {
  test('unauthenticated user is redirected to /login', async ({ page }) => {
    await page.goto('/organizations');
    await expect(page).toHaveURL('/login');
  });

  test('login page has expected elements', async ({ page }) => {
    await page.goto('/login');

    await expect(page.getByLabel('Email')).toBeVisible();
    await expect(page.getByLabel('Password')).toBeVisible();
    await expect(
      page.getByRole('button', { name: 'Sign in' }),
    ).toBeVisible();
    await expect(page.getByText('Forgot password?')).toBeVisible();
    await expect(page.getByText("Don't have an account?")).toBeVisible();
  });

  test('navigate from login to register', async ({ page }) => {
    await page.goto('/login');
    await page.getByRole('link', { name: 'Sign up' }).click();
    await expect(page).toHaveURL('/register');
  });

  test('register new user redirects to verify-email page', async ({
    page,
  }) => {
    await page.goto('/register');

    const email = `e2e-register-${Date.now()}@test.quantyx.io`;
    await page.getByLabel('Name').fill('Test Register');
    await page.getByLabel('Email').fill(email);
    await page.getByLabel('Password').fill('TestPassword123!');
    await page.getByRole('button', { name: 'Create account' }).click();

    await expect(page).toHaveURL('/verify-email');
    await expect(page.getByText('Back to sign in')).toBeVisible();
  });

  test('login after email verification', async ({
    page,
    createVerifiedUser,
  }) => {
    const user = await createVerifiedUser();

    // Navigate to login after registration + verification
    await page.goto('/login');
    await page.getByLabel('Email').fill(user.email);
    await page.getByLabel('Password').fill(user.password);
    await page.getByRole('button', { name: 'Sign in' }).click();

    // Should redirect to organizations page after login
    await expect(page).toHaveURL('/organizations', { timeout: 10_000 });
  });

  test('invalid credentials show error', async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel('Email').fill('nonexistent@test.quantyx.io');
    await page.getByLabel('Password').fill('WrongPassword123!');
    await page.getByRole('button', { name: 'Sign in' }).click();

    // Sonner toast should appear with error
    await expect(page.getByRole('status')).toContainText(
      /invalid|credentials|error/i,
      { timeout: 5_000 },
    );
  });

  test('sign out returns to login', async ({ page, createVerifiedUser }) => {
    const user = await createVerifiedUser();

    // Log in
    await page.goto('/login');
    await page.getByLabel('Email').fill(user.email);
    await page.getByLabel('Password').fill(user.password);
    await page.getByRole('button', { name: 'Sign in' }).click();
    await expect(page).toHaveURL('/organizations', { timeout: 10_000 });

    // Sign out from sidebar
    await page.getByText('Sign out').click();
    await expect(page).toHaveURL('/login', { timeout: 5_000 });
  });

  test('forgot password link navigates to forgot-password page', async ({
    page,
  }) => {
    await page.goto('/login');
    await page.getByText('Forgot password?').click();
    await expect(page).toHaveURL('/forgot-password');

    await expect(page.getByLabel('Email')).toBeVisible();
    await expect(
      page.getByRole('button', { name: 'Send reset link' }),
    ).toBeVisible();
  });
});
