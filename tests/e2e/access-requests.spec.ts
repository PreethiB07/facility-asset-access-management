import { test, expect } from '@playwright/test';
import { login } from './helpers/auth';
import { credentials } from './helpers/credentials';
import {
  expectAccessRequestSuccess,
  expectRequestInList,
  submitAccessRequest,
} from './helpers/access-request';
import { futureDateTimeLocal, uniqueSuffix } from './helpers/dates';
import { ACME } from './helpers/seed-data';

test.describe('Access requests', () => {
  test.beforeEach(async ({ page }) => {
    await login(page, credentials.acme.user.email, credentials.acme.user.password);
  });

  test('facility access request appears in My Requests as pending', async ({ page }) => {
    const reason = `E2E facility request ${uniqueSuffix()}`;

    await page.getByRole('link', { name: 'Facilities' }).click();
    await page.getByRole('link', { name: 'View Details' }).first().click();
    await expect(page.getByRole('heading', { name: ACME.mainOperationsFacility })).toBeVisible();

    await submitAccessRequest(page, {
      accessType: 'PERMANENT',
      startAt: futureDateTimeLocal(0),
      reason,
    });

    await expectAccessRequestSuccess(page);
    await expectRequestInList(page, reason, 'PENDING');
  });

  test('area access request shows target details', async ({ page }) => {
    const reason = `E2E area request ${uniqueSuffix()}`;

    await page.getByRole('link', { name: 'Facilities' }).click();
    await page
      .getByRole('article')
      .filter({ has: page.getByRole('heading', { name: ACME.mainOperationsFacility }) })
      .getByRole('link', { name: 'View Details' })
      .click();
    await page.getByRole('link', { name: ACME.equipmentRoom }).click();

    await submitAccessRequest(page, {
      accessType: 'PERMANENT',
      startAt: futureDateTimeLocal(0),
      reason,
    });

    await expectAccessRequestSuccess(page);
    await expectRequestInList(page, reason, 'APPROVED');

    await page.locator('tbody tr').filter({ hasText: reason }).getByRole('link', { name: 'View details' }).click();
    await expect(page).toHaveURL(/\/access-requests\//);
    await expect(page.getByText(reason)).toBeVisible();
    await expect(page.locator('.detail-grid').getByText('AREA')).toBeVisible();
  });

  test('asset inside area access request', async ({ page }) => {
    const reason = `E2E area asset request ${uniqueSuffix()}`;

    await page.getByRole('link', { name: 'Facilities' }).click();
    await page
      .getByRole('article')
      .filter({ has: page.getByRole('heading', { name: ACME.mainOperationsFacility }) })
      .getByRole('link', { name: 'View Details' })
      .click();
    await page.getByRole('link', { name: ACME.generator }).click();

    await submitAccessRequest(page, {
      accessType: 'PERMANENT',
      startAt: futureDateTimeLocal(0),
      reason,
    });

    await expectAccessRequestSuccess(page);
    await expectRequestInList(page, reason, 'PENDING');
  });

  test('independent facility asset access request', async ({ page }) => {
    const reason = `E2E independent asset request ${uniqueSuffix()}`;

    await page.getByRole('link', { name: 'Facilities' }).click();
    await page
      .getByRole('article')
      .filter({ has: page.getByRole('heading', { name: ACME.mainOperationsFacility }) })
      .getByRole('link', { name: 'View Details' })
      .click();
    await page.getByRole('link', { name: ACME.independentAsset }).click();

    await submitAccessRequest(page, {
      accessType: 'PERMANENT',
      startAt: futureDateTimeLocal(0),
      reason,
    });

    await expectAccessRequestSuccess(page);
    await expectRequestInList(page, reason, 'PENDING');
  });

  test('temporary access submits start and end dates', async ({ page }) => {
    const reason = `E2E temporary request ${uniqueSuffix()}`;
    const startAt = futureDateTimeLocal(1);
    const endAt = futureDateTimeLocal(3);

    await page.getByRole('link', { name: 'Facilities' }).click();
    await page
      .getByRole('article')
      .filter({ has: page.getByRole('heading', { name: ACME.mainOperationsFacility }) })
      .getByRole('link', { name: 'View Details' })
      .click();

    await submitAccessRequest(page, {
      accessType: 'TEMPORARY',
      startAt,
      endAt,
      reason,
    });

    await expectAccessRequestSuccess(page);
    await page.getByRole('link', { name: 'My Requests' }).click();
    const row = page.locator('tbody tr').filter({ hasText: reason });
    await expect(row).toContainText('TEMPORARY');
  });

  test('permanent access does not require end date', async ({ page }) => {
    const reason = `E2E permanent request ${uniqueSuffix()}`;

    await page.getByRole('link', { name: 'Facilities' }).click();
    await page
      .getByRole('article')
      .filter({ has: page.getByRole('heading', { name: ACME.mainOperationsFacility }) })
      .getByRole('link', { name: 'View Details' })
      .click();

    await page.locator('#accessType').selectOption('PERMANENT');
    await expect(page.locator('#endAt')).toHaveCount(0);

    await submitAccessRequest(page, {
      accessType: 'PERMANENT',
      startAt: futureDateTimeLocal(0),
      reason,
    });

    await expectAccessRequestSuccess(page);
    await page.getByRole('link', { name: 'My Requests' }).click();
    const row = page.locator('tbody tr').filter({ hasText: reason });
    await expect(row).toContainText('PERMANENT');
  });

  test('automatic approval shows access in My Access', async ({ page }) => {
    const reason = `E2E auto approve ${uniqueSuffix()}`;

    await page.getByRole('link', { name: 'Facilities' }).click();
    await page
      .getByRole('article')
      .filter({ has: page.getByRole('heading', { name: ACME.productionFacility }) })
      .getByRole('link', { name: 'View Details' })
      .click();

    await submitAccessRequest(page, {
      accessType: 'PERMANENT',
      startAt: futureDateTimeLocal(0),
      reason,
    });

    await expectAccessRequestSuccess(page);
    await expectRequestInList(page, reason, 'APPROVED');

    await page.getByRole('link', { name: 'My Access' }).click();
    await expect(page.getByRole('heading', { name: 'My Current Access' })).toBeVisible();
    await expect(page.getByRole('row', { name: new RegExp(ACME.productionFacility) }).first()).toBeVisible();
  });
});
