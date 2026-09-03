import { test, expect } from '@playwright/test';
import { login } from './helpers/auth';
import { credentials } from './helpers/credentials';
import { ACME } from './helpers/seed-data';

test.describe('Facility browsing', () => {
  test.beforeEach(async ({ page }) => {
    await login(page, credentials.acme.user.email, credentials.acme.user.password);
  });

  test('Company A user browses facilities, areas, and assets', async ({ page }) => {
    await page.getByRole('link', { name: 'Facilities' }).click();
    await expect(page.getByRole('heading', { name: 'Facilities' })).toBeVisible();

    const mainFacilityCard = page.getByRole('article').filter({
      has: page.getByRole('heading', { name: ACME.mainOperationsFacility }),
    });
    await expect(mainFacilityCard).toBeVisible();
    await expect(page.getByRole('heading', { name: ACME.productionFacility })).toBeVisible();
    await expect(page.getByRole('heading', { name: ACME.inactiveFacility })).not.toBeVisible();

    await mainFacilityCard.getByRole('link', { name: 'View Details' }).click();
    await expect(page.getByRole('heading', { name: ACME.mainOperationsFacility })).toBeVisible();
    await expect(page.getByRole('link', { name: ACME.serverRoom })).toBeVisible();
    await expect(page.getByRole('link', { name: ACME.independentAsset })).toBeVisible();

    await page.getByRole('link', { name: ACME.serverRoom }).click();
    await expect(page.getByRole('heading', { name: ACME.serverRoom })).toBeVisible();

    await page.getByRole('link', { name: 'View facility' }).click();
    await page.getByRole('link', { name: ACME.generator }).click();
    await expect(page.getByRole('heading', { name: ACME.generator })).toBeVisible();
    await expect(page.getByText('Request Access')).toBeVisible();
  });
});
