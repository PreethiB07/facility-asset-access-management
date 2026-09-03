import type { Page } from '@playwright/test';

export async function selectReactOption(page: Page, selector: string, label: string): Promise<void> {
  await page.locator(selector).evaluate((element, text) => {
    const select = element as HTMLSelectElement;
    const option = Array.from(select.options).find((item) => item.text === text);
    if (!option) {
      throw new Error(`Option not found: ${text}`);
    }
    const setter = Object.getOwnPropertyDescriptor(window.HTMLSelectElement.prototype, 'value')?.set;
    setter?.call(select, option.value);
    select.dispatchEvent(new Event('change', { bubbles: true }));
  }, label);
}

export async function fillReactInput(page: Page, selector: string, value: string): Promise<void> {
  await page.locator(selector).evaluate((element, text) => {
    const input = element as HTMLInputElement | HTMLTextAreaElement;
    const prototype =
      input instanceof HTMLTextAreaElement
        ? window.HTMLTextAreaElement.prototype
        : window.HTMLInputElement.prototype;
    const setter = Object.getOwnPropertyDescriptor(prototype, 'value')?.set;
    setter?.call(input, text);
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
  }, value);
}
