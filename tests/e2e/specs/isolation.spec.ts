import { test, expect } from '@playwright/test';
import { LoginPage } from '../pages/LoginPage.ts';
import { EventsPage } from '../pages/EventsPage.ts';
import { USERS, ACME_EVENTS } from '../fixtures/users.ts';

/**
 * Tenant isolation smoke tests — the UI-level guarantee that one org never
 * sees another org's data. The exhaustive API-level matrix (every endpoint x
 * role x org, denial uniformity, side effects) lives in tests/isolation/.
 */
test.describe('tenant isolation (smoke)', () => {
  test("bayline operator's list contains no acme events", async ({ page }) => {
    const login = new LoginPage(page);
    const events = new EventsPage(page);
    await login.open();
    await login.login(USERS.opBayline.email);

    await expect(events.navOrg).toHaveText(USERS.opBayline.org);
    for (const name of ACME_EVENTS) await events.expectAbsent(name);
  });

  test('cross-tenant event read is a 404, not a 403 — existence is not leaked', async ({ request }) => {
    // Discover an acme event id as an acme user…
    const acme = await request.post('/auth/login', { data: { email: USERS.opAcme.email } });
    const acmeToken = (await acme.json()).token as string;
    const list = await request.get('/events', { headers: { Authorization: `Bearer ${acmeToken}` } });
    const { events } = await list.json();
    expect(events.length).toBeGreaterThan(0);
    const targetId = events[0].id;

    // …then try to read it as a bayline user.
    const bayline = await request.post('/auth/login', { data: { email: USERS.opBayline.email } });
    const baylineToken = (await bayline.json()).token as string;
    const res = await request.get(`/events/${targetId}`, {
      headers: { Authorization: `Bearer ${baylineToken}` },
    });
    expect(res.status()).toBe(404);
  });
});
