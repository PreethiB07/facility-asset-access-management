import { test, expect } from '@playwright/test';
import { login } from './helpers/auth';
import { uniqueSuffix } from './helpers/dates';

test.describe('User registration', () => {
  test('registers a new user with default USER role in default company', async ({ page }) => {
    const suffix = uniqueSuffix();
    const email = `e2e.register.${suffix}@example.com`;
    const password = 'RegisterTest@123';
    const name = `E2E Register ${suffix}`;

    await page.goto('/register');
    await page.getByLabel('Name').fill(name);
    await page.getByLabel('Email').fill(email);
    await page.locator('#password').fill(password);
    await page.locator('#confirmPassword').fill(password);
    await page.getByRole('button', { name: 'Register' }).click();

    await expect(page.getByRole('heading', { name: 'Registration successful' })).toBeVisible();
    await page.getByRole('link', { name: 'Go to login' }).click();

    await login(page, email, password);
    await expect(page.getByText('USER')).toBeVisible();
    await expect(page.getByRole('link', { name: 'Administration' })).not.toBeVisible();
    await expect(page.getByRole('link', { name: 'Pending Approvals' })).not.toBeVisible();
  });
});
