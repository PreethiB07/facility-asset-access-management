import { test, expect } from '@playwright/test';
import { login } from './helpers/auth';
import { credentials, apiBaseUrl } from './helpers/credentials';
import {
  createAccessRequest,
  getGlobexMainOperationsFacilityId,
  loginViaApi,
} from './helpers/api';
import { futureDateTimeLocal, uniqueSuffix } from './helpers/dates';
import { ACME, GLOBEX } from './helpers/seed-data';

test.describe('Multi-company browser isolation', () => {
  test('Company A user sees only Acme data', async ({ page }) => {
    await login(page, credentials.acme.user.email, credentials.acme.user.password);
    await page.getByRole('link', { name: 'Facilities' }).click();

    await expect(page.getByRole('heading', { name: ACME.mainOperationsFacility })).toBeVisible();
    await expect(page.getByRole('heading', { name: ACME.productionFacility })).toBeVisible();
    await expect(page.getByRole('heading', { name: GLOBEX.mainOperationsFacility })).not.toBeVisible();
    await expect(page.getByRole('heading', { name: GLOBEX.productionFacility })).not.toBeVisible();

    await page.getByRole('link', { name: 'My Requests' }).click();
    await expect(page.locator('tbody tr').filter({ hasText: /^Globex / })).not.toBeVisible();
  });

  test('Company B user sees only Globex data', async ({ page }) => {
    await login(page, credentials.globex.user.email, credentials.globex.user.password);
    await page.getByRole('link', { name: 'Facilities' }).click();

    await expect(page.getByRole('heading', { name: GLOBEX.mainOperationsFacility })).toBeVisible();
    await expect(page.getByRole('heading', { name: GLOBEX.productionFacility })).toBeVisible();
    await expect(page.getByRole('heading', { name: ACME.mainOperationsFacility })).not.toBeVisible();
    await expect(page.getByRole('heading', { name: ACME.productionFacility })).not.toBeVisible();
  });

  test('Company A user cannot open Company B facility by direct URL', async ({ page }) => {
    const globexFacilityId = await getGlobexMainOperationsFacilityId();

    await login(page, credentials.acme.user.email, credentials.acme.user.password);
    await page.goto(`/facilities/${globexFacilityId}`);

    await expect(page.getByRole('heading', { name: 'Not Found' })).toBeVisible();
    await expect(page.getByRole('alert')).toContainText(/not found/i);
  });

  test('cross-company access request is blocked via API', async ({ page }) => {
    const globexFacilityId = await getGlobexMainOperationsFacilityId();
    const acmeAuth = await loginViaApi(
      credentials.acme.user.email,
      credentials.acme.user.password,
    );

    const response = await page.request.post(`${apiBaseUrl}/api/access-requests`, {
      headers: {
        Authorization: `Bearer ${acmeAuth.token}`,
        'Content-Type': 'application/json',
      },
      data: {
        facilityId: globexFacilityId,
        accessType: 'PERMANENT',
        startAt: new Date().toISOString(),
        reason: `E2E cross-company attempt ${uniqueSuffix()}`,
      },
    });

    expect(response.status()).toBe(404);
    const body = await response.json();
    expect(JSON.stringify(body)).not.toMatch(/globex/i);
  });
});
