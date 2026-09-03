import { test, expect } from '@playwright/test';
import { login, logout } from './helpers/auth';
import { credentials } from './helpers/credentials';
import {
  expectAccessRequestSuccess,
  expectRequestInList,
  submitAccessRequest,
} from './helpers/access-request';
import { futureDateTimeLocal, uniqueSuffix } from './helpers/dates';
import { ACME } from './helpers/seed-data';

test.describe('Manager approval workflow', () => {
  test('manager approves pending request and user sees approved access', async ({ page }) => {
    const reason = `E2E manager approve ${uniqueSuffix()}`;

    await login(page, credentials.acme.user.email, credentials.acme.user.password);
    await page.getByRole('link', { name: 'Facilities' }).click();
    await page
      .getByRole('article')
      .filter({ has: page.getByRole('heading', { name: ACME.mainOperationsFacility }) })
      .getByRole('link', { name: 'View Details' })
      .click();

    await submitAccessRequest(page, {
      accessType: 'PERMANENT',
      startAt: futureDateTimeLocal(0),
      reason,
    });
    await expectAccessRequestSuccess(page);
    await logout(page);

    await login(page, credentials.acme.manager.email, credentials.acme.manager.password);
    await page.getByRole('link', { name: 'Pending Approvals' }).click();
    await expect(page.getByRole('heading', { name: 'Pending Approvals' })).toBeVisible();

    const requestRow = page.locator('tbody tr').filter({ hasText: reason });
    await expect(requestRow).toBeVisible();
    await requestRow.getByRole('button', { name: 'Approve' }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Approve' }).click();
    await expect(page.getByRole('status')).toContainText(/approved/i);
    await expect(requestRow).not.toBeVisible();
    await logout(page);

    await login(page, credentials.acme.user.email, credentials.acme.user.password);
    await expectRequestInList(page, reason, 'APPROVED');
    await page.getByRole('link', { name: 'My Access' }).click();
    await expect(page.getByRole('heading', { name: 'My Current Access' })).toBeVisible();
    await expect(page.getByRole('row', { name: new RegExp(ACME.mainOperationsFacility) }).first()).toBeVisible();
  });

  test('manager rejects pending request with reason visible to user', async ({ page }) => {
    const reason = `E2E manager reject ${uniqueSuffix()}`;
    const rejectionReason = 'E2E rejection — insufficient business justification';

    await login(page, credentials.acme.user.email, credentials.acme.user.password);
    await page.getByRole('link', { name: 'Facilities' }).click();
    await page
      .getByRole('article')
      .filter({ has: page.getByRole('heading', { name: ACME.mainOperationsFacility }) })
      .getByRole('link', { name: 'View Details' })
      .click();

    await submitAccessRequest(page, {
      accessType: 'PERMANENT',
      startAt: futureDateTimeLocal(0),
      reason,
    });
    await expectAccessRequestSuccess(page);
    await logout(page);

    await login(page, credentials.acme.manager.email, credentials.acme.manager.password);
    await page.getByRole('link', { name: 'Pending Approvals' }).click();
    const requestRow = page.locator('tbody tr').filter({ hasText: reason });
    await requestRow.getByRole('button', { name: 'Reject' }).click();
    await page.getByLabel('Reason').fill(rejectionReason);
    await page.getByRole('button', { name: 'Reject Request' }).click();
    await expect(page.getByRole('status')).toContainText(/rejected/i);
    await logout(page);

    await login(page, credentials.acme.user.email, credentials.acme.user.password);
    await expectRequestInList(page, reason, 'REJECTED');
    await page.locator('tbody tr').filter({ hasText: reason }).getByRole('link', { name: 'View details' }).click();
    await expect(page).toHaveURL(/\/access-requests\//);
    await expect(page.getByRole('heading', { name: /Access Request/ })).toBeVisible();
    await expect(page.locator('.detail-section').filter({ hasText: 'Status' }).getByLabel('Status: REJECTED')).toBeVisible();
    await expect(page.getByText(rejectionReason)).toBeVisible();
  });
});
