import { test, expect } from '@playwright/test';
import { LoginPage } from '../pages/LoginPage.ts';
import { EventsPage } from '../pages/EventsPage.ts';
import { USERS } from '../fixtures/users.ts';

test.describe('operator console — events', () => {
  test('operator creates an event and it appears as draft', async ({ page }) => {
    const login = new LoginPage(page);
    const events = new EventsPage(page);
    await login.open();
    await login.login(USERS.opAcme.email);

    const name = `QA Meetup ${Date.now()}`;
    await events.createEvent(name);

    const row = await events.expectVisible(name);
    await expect(row).toContainText('draft');
  });

  test('viewer sees events but cannot create — read-only is enforced in the UI', async ({ page }) => {
    const login = new LoginPage(page);
    const events = new EventsPage(page);
    await login.open();
    await login.login(USERS.viewerAcme.email);

    await expect(events.createForm).toBeHidden();
    await expect(events.disabledNote).toBeVisible();
  });

  test('server rejects an invalid event even if the client is bypassed', async ({ request }) => {
    // The UI validates; the API is the real boundary. Probe it directly.
    const res = await request.post('/auth/login', { data: { email: USERS.opAcme.email } });
    const { token } = await res.json();
    const created = await request.post('/events', {
      headers: { Authorization: `Bearer ${token}` },
      data: { name: '   ', startsAt: 'not-a-date' },
    });
    expect(created.status()).toBe(400);
  });
});
