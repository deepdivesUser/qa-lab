import { test, expect } from '@playwright/test';
import { LoginPage } from '../pages/LoginPage.ts';
import { EventsPage } from '../pages/EventsPage.ts';
import { USERS, ACME_EVENTS } from '../fixtures/users.ts';

test.describe('operator console — authentication', () => {
  test('operator signs in and lands on their org console', async ({ page }) => {
    const login = new LoginPage(page);
    const events = new EventsPage(page);

    await login.open();
    await login.login(USERS.opAcme.email);

    await expect(events.navOrg).toHaveText(USERS.opAcme.org);
    await expect(page.getByTestId('nav-user')).toContainText('operator');
    for (const name of ACME_EVENTS) await events.expectVisible(name);
  });

  test('unknown email is rejected with a visible error', async ({ page }) => {
    const login = new LoginPage(page);
    await login.open();
    await login.login('nobody@nowhere.test');
    await login.expectRejected();
  });

  test('a stale token does not silently restore a session', async ({ page }) => {
    const login = new LoginPage(page);
    await login.open();
    // Simulate a revoked/leftover token — /me must fail and the UI must fall
    // back to the login view rather than assume the session is valid.
    await page.evaluate(() => localStorage.setItem('token', '00000000-0000-0000-0000-000000000000'));
    await page.reload();
    await expect(page.getByTestId('login-view')).toBeVisible();
  });
});
