import { test, expect } from '@playwright/test';
import { login } from './helpers/auth';
import { credentials } from './helpers/credentials';
import { futureDateTimeLocal } from './helpers/dates';
import { ACME } from './helpers/seed-data';

test.describe('Error handling', () => {
  test('login form validates required fields', async ({ page }) => {
    await page.goto('/login');
    await page.getByRole('button', { name: 'Login' }).click();

    await expect(page.getByText('Email is required.')).toBeVisible();
    await expect(page.getByText('Password is required')).toBeVisible();
  });

  test('access request form validates missing reason and invalid dates', async ({ page }) => {
    await login(page, credentials.acme.user.email, credentials.acme.user.password);
    await page.getByRole('link', { name: 'Facilities' }).click();
    await page
      .getByRole('article')
      .filter({ has: page.getByRole('heading', { name: ACME.mainOperationsFacility }) })
      .getByRole('link', { name: 'View Details' })
      .click();

    await page.getByRole('button', { name: 'Submit request' }).click();
    await expect(page.getByText('Please select an access type')).toBeVisible();
    await expect(page.getByText('Start date and time is required')).toBeVisible();
    await expect(page.getByText('Please provide a reason for this request')).toBeVisible();

    await page.getByRole('main').getByRole('combobox', { name: /Access type/i }).selectOption('TEMPORARY');
    const startAt = futureDateTimeLocal(2);
    const endAt = futureDateTimeLocal(1);
    await page.getByRole('main').locator('#startAt').fill(startAt);
    await page.getByRole('main').locator('#endAt').fill(endAt);
    await page.getByRole('main').locator('#reason').fill('Invalid date range test');
    await page.getByRole('button', { name: 'Submit request' }).click();
    await expect(page.getByText('End date must be after the start date')).toBeVisible();
  });

  test('error responses do not expose stack traces', async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel('Email').fill(credentials.acme.user.email);
    await page.locator('#password').fill('WrongPassword!123');
    await page.getByRole('button', { name: 'Login' }).click();

    const alert = page.getByRole('alert');
    await expect(alert).toBeVisible();
    await expect(alert).not.toContainText(/stack/i);
    await expect(alert).not.toContainText(/prisma/i);
    await expect(alert).not.toContainText(/sql/i);
  });

  test('unauthorized users are redirected from protected routes', async ({ page }) => {
    await page.goto('/admin');
    await expect(page).toHaveURL(/\/login/);
  });
});
