import { test, expect } from '@playwright/test';
import { login } from './helpers/auth';
import { credentials } from './helpers/credentials';
import { uniqueSuffix } from './helpers/dates';
import { fillReactInput } from './helpers/form';
import { createAreaViaApi, createAssetViaApi, getFacilityIdByName, loginViaApi } from './helpers/api';

test.describe('Admin facility management', () => {
  test.beforeEach(async ({ page }) => {
    await login(page, credentials.acme.admin.email, credentials.acme.admin.password);
    await page.getByRole('link', { name: 'Administration' }).click();
    await expect(page.getByRole('heading', { name: 'Administration' })).toBeVisible();
  });

  test('creates facility, area, and asset with unique names', async ({ page }) => {
    const suffix = uniqueSuffix();
    const facilityName = `E2E Admin Facility ${suffix}`;
    const areaName = `E2E Admin Area ${suffix}`;
    const assetName = `E2E Admin Asset ${suffix}`;

    await page.getByRole('button', { name: '+ Add Facility' }).click();
    await fillReactInput(page, '#facilityName', facilityName);
    await fillReactInput(page, '#facilityDescription', 'Created by E2E admin test');
    await page
      .getByRole('dialog', { name: 'Create facility' })
      .getByRole('button', { name: 'Create facility' })
      .click();
    await expect(page.locator('.toast-success')).toContainText(/facility created successfully/i);
    await expect(page.getByRole('cell', { name: facilityName })).toBeVisible();

    const auth = await loginViaApi(credentials.acme.admin.email, credentials.acme.admin.password);
    const facilityId = await getFacilityIdByName(auth.token, facilityName);
    const area = await createAreaViaApi(auth.token, facilityId, {
      name: areaName,
      description: 'E2E admin area',
    });
    await createAssetViaApi(auth.token, {
      facilityId,
      areaId: area.id,
      name: assetName,
      description: 'E2E admin asset',
    });

    await page.getByRole('tab', { name: 'Areas' }).click();
    await expect(page.getByRole('cell', { name: areaName })).toBeVisible();

    await page.getByRole('tab', { name: 'Assets' }).click();
    await expect(page.getByRole('cell', { name: assetName })).toBeVisible();

    await page.getByRole('link', { name: 'Facilities' }).click();
    await page
      .getByRole('article')
      .filter({ has: page.getByRole('heading', { name: facilityName }) })
      .getByRole('link', { name: 'View Details' })
      .click();
    await expect(page.getByRole('link', { name: areaName })).toBeVisible();
    await expect(page.getByRole('link', { name: assetName })).toBeVisible();
  });
});
