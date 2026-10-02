import { type Page, type Locator, expect } from '@playwright/test';

export class EventsPage {
  readonly page: Page;
  readonly createForm: Locator;
  readonly createName: Locator;
  readonly createDate: Locator;
  readonly createSubmit: Locator;
  readonly disabledNote: Locator;
  readonly consoleError: Locator;

  constructor(page: Page) {
    this.page = page;
    this.createForm = page.getByTestId('create-form');
    this.createName = page.getByTestId('create-event-name');
    this.createDate = page.getByTestId('create-event-date');
    this.createSubmit = page.getByTestId('create-event-submit');
    this.disabledNote = page.getByTestId('create-disabled-note');
    this.consoleError = page.getByTestId('console-error');
  }

  get navOrg(): Locator {
    return this.page.getByTestId('nav-org');
  }

  eventRow(name: string): Locator {
    return this.page.getByTestId('event-row').filter({ hasText: name });
  }

  async expectVisible(name: string): Promise<Locator> {
    const row = this.eventRow(name);
    await expect(row).toBeVisible();
    return row;
  }

  async expectAbsent(name: string): Promise<void> {
    await expect(this.eventRow(name)).toHaveCount(0);
  }

  async createEvent(name: string, when = '2026-12-01T18:00'): Promise<void> {
    await this.createName.fill(name);
    await this.createDate.fill(when);
    await this.createSubmit.click();
  }
}
