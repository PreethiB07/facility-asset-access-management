import type { Page } from '@playwright/test';
import { expect } from '@playwright/test';

export async function login(page: Page, email: string, password: string): Promise<void> {
  await page.goto('/login');
  await page.getByLabel('Email').fill(email);
  await page.locator('#password').fill(password);
  await page.getByRole('button', { name: 'Login' }).click();
  await expect(page.getByRole('navigation', { name: 'Main navigation' })).toBeVisible();
}

export async function logout(page: Page): Promise<void> {
  await page.getByRole('button', { name: 'Logout' }).click();
  await expect(page).toHaveURL(/\/login/);
}

export async function expectAuthenticated(page: Page): Promise<void> {
  await expect(page.getByRole('navigation', { name: 'Main navigation' })).toBeVisible();
}

export async function expectUnauthenticated(page: Page): Promise<void> {
  await expect(page).toHaveURL(/\/login/);
}

export function mainNavigation(page: Page) {
  return page.getByRole('navigation', { name: 'Main navigation' });
}
