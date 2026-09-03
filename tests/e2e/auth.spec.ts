import { test, expect } from '@playwright/test';
import { login, logout, expectUnauthenticated, mainNavigation } from './helpers/auth';
import { credentials } from './helpers/credentials';

test.describe('Authentication', () => {
  test('valid login reaches dashboard with authenticated navigation', async ({ page }) => {
    await login(page, credentials.acme.user.email, credentials.acme.user.password);

    await expect(page.locator('.user-name')).toHaveText('Demo User');
    await expect(mainNavigation(page).getByRole('link', { name: 'Facilities' })).toBeVisible();
    await expect(mainNavigation(page).getByRole('link', { name: 'My Requests' })).toBeVisible();
    await expect(mainNavigation(page).getByRole('link', { name: 'My Access' })).toBeVisible();

    await mainNavigation(page).getByRole('link', { name: 'Facilities' }).click();
    await expect(page).toHaveURL(/\/facilities/);
    await expect(page.getByRole('heading', { name: 'Facilities' })).toBeVisible();
  });

  test('invalid login shows error and does not authenticate', async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel('Email').fill(credentials.acme.user.email);
    await page.locator('#password').fill('WrongPassword!123');
    await page.getByRole('button', { name: 'Login' }).click();

    await expect(page.getByRole('alert')).toBeVisible();
    await expect(page).toHaveURL(/\/login/);
    await expect(page.getByRole('navigation', { name: 'Main navigation' })).not.toBeVisible();
  });

  test('protected route redirects unauthenticated users to login', async ({ page }) => {
    await page.goto('/facilities');
    await expectUnauthenticated(page);
  });

  test('logout clears authenticated session', async ({ page }) => {
    await login(page, credentials.acme.user.email, credentials.acme.user.password);
    await logout(page);
    await page.goto('/dashboard');
    await expectUnauthenticated(page);
  });
});
