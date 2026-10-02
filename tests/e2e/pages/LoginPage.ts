import { type Page, type Locator, expect } from '@playwright/test';

export class LoginPage {
  readonly page: Page;
  readonly emailInput: Locator;
  readonly submit: Locator;
  readonly error: Locator;

  constructor(page: Page) {
    this.page = page;
    this.emailInput = page.getByTestId('login-email');
    this.submit = page.getByTestId('login-submit');
    this.error = page.getByTestId('login-error');
  }

  async open(): Promise<void> {
    await this.page.goto('/');
    // A stale token from a previous test would skip the login view.
    await this.page.evaluate(() => localStorage.removeItem('token'));
    await this.page.reload();
    await expect(this.page.getByTestId('login-view')).toBeVisible();
  }

  async login(email: string): Promise<void> {
    await this.emailInput.fill(email);
    await this.submit.click();
  }

  async expectRejected(): Promise<void> {
    await expect(this.error).toBeVisible();
    await expect(this.page.getByTestId('console-view')).toBeHidden();
  }
}
