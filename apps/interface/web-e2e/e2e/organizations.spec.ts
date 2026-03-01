import { test, expect } from './fixtures';

test.describe('Organizations', () => {
  test.describe('authenticated user', () => {
    let email: string;
    let password: string;

    test.beforeEach(async ({ page, createVerifiedUser }) => {
      const user = await createVerifiedUser();
      email = user.email;
      password = user.password;

      // Log in
      await page.goto('/login');
      await page.getByLabel('Email').fill(email);
      await page.getByLabel('Password').fill(password);
      await page.getByRole('button', { name: 'Sign in' }).click();
      await expect(page).toHaveURL('/organizations', { timeout: 10_000 });
    });

    test('organizations page shows empty state', async ({ page }) => {
      await expect(
        page.getByText('No organizations yet'),
      ).toBeVisible();
    });

    test('create organization', async ({ page }) => {
      await page.getByRole('button', { name: /New organization/ }).click();

      // Dialog should open
      await expect(page.getByText('Create organization')).toBeVisible();

      await page.getByLabel('Name').fill('Test Organization');
      await page.getByRole('button', { name: 'Create' }).click();

      // Toast and org card should appear
      await expect(page.getByText('Organization created')).toBeVisible({
        timeout: 5_000,
      });
      await expect(page.getByText('Test Organization')).toBeVisible();
    });

    test('navigate to organization detail', async ({ page }) => {
      // Create an org first
      await page.getByRole('button', { name: /New organization/ }).click();
      await page.getByLabel('Name').fill('Detail Test Org');
      await page.getByRole('button', { name: 'Create' }).click();
      await expect(page.getByText('Organization created')).toBeVisible({
        timeout: 5_000,
      });

      // Click on the org card
      await page.getByText('Detail Test Org').click();

      // Should be on org detail page
      await expect(
        page.getByRole('heading', { name: 'Detail Test Org' }),
      ).toBeVisible();
      await expect(page.getByRole('heading', { name: 'Projects' })).toBeVisible();
    });

    test('update organization name in settings', async ({ page }) => {
      // Create an org
      await page.getByRole('button', { name: /New organization/ }).click();
      await page.getByLabel('Name').fill('Org Before Rename');
      await page.getByRole('button', { name: 'Create' }).click();
      await expect(page.getByText('Organization created')).toBeVisible({
        timeout: 5_000,
      });

      // Navigate to org detail -> settings
      await page.getByText('Org Before Rename').click();
      await page.getByRole('link', { name: /Settings/ }).click();

      // Update the name
      const nameInput = page.locator('#org-name');
      await nameInput.clear();
      await nameInput.fill('Org After Rename');
      await page.getByRole('button', { name: 'Save changes' }).click();

      await expect(page.getByText('Organization updated')).toBeVisible({
        timeout: 5_000,
      });
    });

    test('delete organization with confirmation', async ({ page }) => {
      // Create an org
      await page.getByRole('button', { name: /New organization/ }).click();
      await page.getByLabel('Name').fill('Org To Delete');
      await page.getByRole('button', { name: 'Create' }).click();
      await expect(page.getByText('Organization created')).toBeVisible({
        timeout: 5_000,
      });

      // Navigate to org settings
      await page.getByText('Org To Delete').click();
      await page.getByRole('link', { name: /Settings/ }).click();

      // Click delete to open confirmation dialog
      await page
        .getByRole('button', { name: 'Delete organization' })
        .first()
        .click();

      // Wait for dialog, then type confirmation
      const dialog = page.getByRole('dialog');
      await expect(dialog).toBeVisible();
      await dialog.getByRole('textbox').fill('Org To Delete');

      // Confirm deletion — click the red destructive button inside the dialog
      await dialog
        .getByRole('button', { name: 'Delete organization' })
        .click();

      // Should redirect to organizations list
      await expect(page).toHaveURL('/organizations', { timeout: 10_000 });
      await expect(page.getByText('Organization deleted')).toBeVisible();
    });

    test('empty state when no organizations exist', async ({ page }) => {
      // Fresh user — no orgs
      await expect(
        page.getByText('No organizations yet'),
      ).toBeVisible();
      await expect(
        page.getByText('Create one to get started'),
      ).toBeVisible();
    });
  });
});
