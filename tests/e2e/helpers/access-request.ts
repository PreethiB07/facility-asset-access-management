import type { Page } from '@playwright/test';
import { expect } from '@playwright/test';

export interface AccessRequestFormInput {
  accessType: 'TEMPORARY' | 'PERMANENT';
  startAt: string;
  endAt?: string;
  reason: string;
}

async function setAccessType(page: Page, accessType: 'TEMPORARY' | 'PERMANENT'): Promise<void> {
  const select = page.getByRole('main').locator('#accessType');
  await select.selectOption(accessType);
  await select.evaluate((element, value) => {
    const input = element as HTMLSelectElement;
    input.value = value;
    input.dispatchEvent(new Event('change', { bubbles: true }));
  }, accessType);
  await expect(select).toHaveValue(accessType);
}

export async function submitAccessRequest(
  page: Page,
  input: AccessRequestFormInput,
): Promise<void> {
  await expect(page.getByRole('heading', { name: 'Request Access', exact: true })).toBeVisible();

  await setAccessType(page, input.accessType);
  await page.getByRole('main').locator('#startAt').fill(input.startAt);

  if (input.accessType === 'TEMPORARY') {
    if (!input.endAt) {
      throw new Error('endAt is required for temporary access requests');
    }
    await expect(page.getByRole('main').locator('#endAt')).toBeVisible();
    await page.getByRole('main').locator('#endAt').fill(input.endAt);
  }

  await page.getByRole('main').locator('#reason').fill(input.reason);
  await page.getByRole('button', { name: 'Submit request' }).click();
}

export async function submitOnBehalfAccessRequest(
  page: Page,
  employeeOptionLabel: string,
  input: AccessRequestFormInput,
): Promise<void> {
  await expect(page.getByRole('heading', { name: 'Request Access', exact: true })).toBeVisible();
  await page.getByLabel('Beneficiary').selectOption('employee');
  await page.locator('#employeeSelect').selectOption({ label: employeeOptionLabel });
  await submitAccessRequest(page, input);
}

export { setAccessType };

export async function expectAccessRequestSuccess(page: Page): Promise<void> {
  await expect(page.locator('.toast-success')).toContainText(/submitted successfully|approved/i);
}

export async function expectRequestInList(
  page: Page,
  reason: string,
  status: 'PENDING' | 'APPROVED' | 'REJECTED',
): Promise<void> {
  await page.getByRole('navigation', { name: 'Main navigation' }).getByRole('link', { name: 'My Requests' }).click();
  await expect(page.getByRole('heading', { name: 'My Access Requests' })).toBeVisible();

  const row = page.locator('tbody tr').filter({ hasText: reason });
  await expect(row).toHaveCount(1);
  await expect(row.getByLabel(`Status: ${status}`)).toBeVisible();
}
