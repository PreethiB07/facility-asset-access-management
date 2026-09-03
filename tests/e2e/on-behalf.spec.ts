import { test, expect } from '@playwright/test';
import { login } from './helpers/auth';
import { credentials } from './helpers/credentials';
import {
  expectAccessRequestSuccess,
  expectRequestInList,
  submitAccessRequest,
  submitOnBehalfAccessRequest,
} from './helpers/access-request';
import { futureDateTimeLocal, uniqueSuffix } from './helpers/dates';
import { ACME } from './helpers/seed-data';

async function openMainOperationsFacility(page: import('@playwright/test').Page) {
  await page.getByRole('link', { name: 'Facilities' }).click();
  await page
    .getByRole('article')
    .filter({ has: page.getByRole('heading', { name: ACME.mainOperationsFacility }) })
    .getByRole('link', { name: 'View Details' })
    .click();
}

test.describe('Manager on-behalf access requests', () => {
  test('manager creates request for employee and employee sees it', async ({ page }) => {
    const reason = `E2E on-behalf request ${uniqueSuffix()}`;

    await login(page, credentials.acme.manager.email, credentials.acme.manager.password);
    await page.getByRole('link', { name: 'Facilities' }).click();
    await page
      .getByRole('article')
      .filter({ has: page.getByRole('heading', { name: ACME.productionFacility }) })
      .getByRole('link', { name: 'View Details' })
      .click();

    await submitOnBehalfAccessRequest(page, 'Demo User (demo.user@example.com)', {
      accessType: 'PERMANENT',
      startAt: futureDateTimeLocal(0),
      reason,
    });
    await expectAccessRequestSuccess(page);

    await page.getByRole('button', { name: 'Logout' }).click();
    await login(page, credentials.acme.user.email, credentials.acme.user.password);
    await page.getByRole('link', { name: 'My Requests' }).click();
    await expect(page.getByText(reason)).toBeVisible();
  });

  test('manager cannot approve own created request', async ({ page }) => {
    const reason = `E2E creator restriction ${uniqueSuffix()}`;

    await login(page, credentials.acme.manager.email, credentials.acme.manager.password);
    await openMainOperationsFacility(page);

    await submitAccessRequest(page, {
      accessType: 'PERMANENT',
      startAt: futureDateTimeLocal(0),
      reason,
    });
    await expectAccessRequestSuccess(page);

    await page.getByRole('link', { name: 'Pending Approvals' }).click();
    const row = page.getByRole('row').filter({ hasText: reason });
    await expect(row.getByText('You created this request')).toBeVisible();
    await expect(row.getByRole('button', { name: 'Approve' })).toHaveCount(0);
  });

  test('admin approves on-behalf request and employee gets access', async ({ page }) => {
    const reason = `E2E on-behalf approval ${uniqueSuffix()}`;

    await login(page, credentials.acme.manager.email, credentials.acme.manager.password);
    await openMainOperationsFacility(page);
    await page.getByRole('link', { name: ACME.serverRoom }).click();

    await submitOnBehalfAccessRequest(page, 'Demo User (demo.user@example.com)', {
      accessType: 'PERMANENT',
      startAt: '2020-01-01T09:00',
      reason,
    });
    await expectAccessRequestSuccess(page);

    await page.getByRole('button', { name: 'Logout' }).click();
    await login(page, credentials.acme.admin.email, credentials.acme.admin.password);
    await page.getByRole('link', { name: 'Pending Approvals' }).click();
    const row = page.getByRole('row').filter({ hasText: reason });
    await row.getByRole('button', { name: 'Approve' }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Approve' }).click();
    await expect(page.locator('.toast-success')).toContainText(/approved/i);

    await page.getByRole('button', { name: 'Logout' }).click();
    await login(page, credentials.acme.user.email, credentials.acme.user.password);
    await expectRequestInList(page, reason, 'APPROVED');
    await page.getByRole('link', { name: 'My Access' }).click();
    await expect(page.getByRole('heading', { name: 'My Current Access' })).toBeVisible();
    await expect(page.getByRole('row').filter({ hasText: ACME.serverRoom }).first()).toBeVisible();
  });
});
