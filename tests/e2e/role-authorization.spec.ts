import { test, expect } from '@playwright/test';
import { login, mainNavigation } from './helpers/auth';
import { credentials } from './helpers/credentials';

test.describe('Role authorization', () => {
  test('USER cannot access admin or manager-only pages', async ({ page }) => {
    await login(page, credentials.acme.user.email, credentials.acme.user.password);

    await expect(mainNavigation(page).getByRole('link', { name: 'Administration' })).not.toBeVisible();
    await expect(mainNavigation(page).getByRole('link', { name: 'Pending Approvals' })).not.toBeVisible();

    await page.goto('/admin');
    await expect(page).toHaveURL(/\/dashboard/);

    await page.goto('/manager/requests');
    await expect(page).toHaveURL(/\/dashboard/);
  });

  test('MANAGER can access pending approvals but not administration', async ({ page }) => {
    await login(page, credentials.acme.manager.email, credentials.acme.manager.password);

    await expect(mainNavigation(page).getByRole('link', { name: 'Pending Approvals' })).toBeVisible();
    await expect(mainNavigation(page).getByRole('link', { name: 'Administration' })).not.toBeVisible();

    await mainNavigation(page).getByRole('link', { name: 'Pending Approvals' }).click();
    await expect(page.getByRole('heading', { name: 'Pending Approvals' })).toBeVisible();

    await page.goto('/admin');
    await expect(page).toHaveURL(/\/dashboard/);
  });

  test('ADMIN can access administration and pending approvals', async ({ page }) => {
    await login(page, credentials.acme.admin.email, credentials.acme.admin.password);

    await expect(mainNavigation(page).getByRole('link', { name: 'Administration' })).toBeVisible();
    await expect(mainNavigation(page).getByRole('link', { name: 'Pending Approvals' })).toBeVisible();

    await mainNavigation(page).getByRole('link', { name: 'Administration' }).click();
    await expect(page.getByRole('heading', { name: 'Administration' })).toBeVisible();
  });
});
