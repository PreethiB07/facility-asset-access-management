import { test, expect } from '@playwright/test';
import { login } from './helpers/auth';
import { credentials } from './helpers/credentials';
import { getAcmeInactiveFacilityId } from './helpers/api';
import { futureDateTimeLocal, uniqueSuffix } from './helpers/dates';
import { submitAccessRequest } from './helpers/access-request';
import { ACME } from './helpers/seed-data';

test.describe('Inactive resources', () => {
  test('inactive facility is hidden from user browsing and direct URL shows not found', async ({
    page,
  }) => {
    const inactiveFacilityId = await getAcmeInactiveFacilityId();

    await login(page, credentials.acme.user.email, credentials.acme.user.password);
    await page.getByRole('link', { name: 'Facilities' }).click();
    await expect(page.getByRole('heading', { name: ACME.inactiveFacility })).not.toBeVisible();

    await page.goto(`/facilities/${inactiveFacilityId}`);
    await expect(page.getByRole('heading', { name: 'Not Found' })).toBeVisible();
  });

  test('access request against inactive facility is blocked', async ({ page }) => {
    const inactiveFacilityId = await getAcmeInactiveFacilityId();

    await login(page, credentials.acme.user.email, credentials.acme.user.password);
    await page.goto(`/facilities/${inactiveFacilityId}`);

    await expect(page.getByRole('heading', { name: 'Not Found' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Submit request' })).not.toBeVisible();
  });

  test('expired temporary access is not shown in My Access', async ({ page }) => {
    const reason = `E2E expired access ${uniqueSuffix()}`;

    await login(page, credentials.acme.user.email, credentials.acme.user.password);
    await page.getByRole('link', { name: 'Facilities' }).click();
    await page
      .getByRole('article')
      .filter({ has: page.getByRole('heading', { name: ACME.productionFacility }) })
      .getByRole('link', { name: 'View Details' })
      .click();

    await submitAccessRequest(page, {
      accessType: 'TEMPORARY',
      startAt: futureDateTimeLocal(-5),
      endAt: futureDateTimeLocal(-1),
      reason,
    });

    await expect(page.getByRole('status')).toContainText(/approved/i);

    await page.getByRole('link', { name: 'My Access' }).click();
    await expect(page.locator('tbody tr').filter({ hasText: reason })).not.toBeVisible();
  });
});
