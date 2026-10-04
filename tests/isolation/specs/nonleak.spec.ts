import { test, expect } from '@playwright/test';
import { EVENTS } from '../src/matrix.ts';
import { login, bearer } from '../../e2e/fixtures/api.ts';
import { USERS } from '../../e2e/fixtures/users.ts';

/**
 * Non-leak probes: it's not enough that cross-tenant access is DENIED — the
 * denial must be indistinguishable from "this thing doesn't exist." A 404
 * that says "not found (but it's totally another org's event)" is an IDOR
 * finding with extra steps.
 */
test('cross-org 404 body is byte-identical to a nonexistent id 404 body', async ({ request }) => {
  const token = await login(request, USERS.opAcme.email);
  const headers = bearer(token);

  const crossOrg = await request.get(`/events/${EVENTS.bayline}`, { headers });
  const nonexistent = await request.get(`/events/${EVENTS.nonexistent}`, { headers });

  expect(crossOrg.status()).toBe(404);
  expect(nonexistent.status()).toBe(404);
  expect(await crossOrg.text()).toBe(await nonexistent.text());
});

test('error bodies never name the resource or the other org', async ({ request }) => {
  const token = await login(request, USERS.viewerBayline.email);
  const res = await request.get(`/events/${EVENTS.acme}`, { headers: bearer(token) });
  const body = await res.text();

  // The seed event names and org names are known; none may appear in a denial.
  for (const leak of ['Acme Summer Kickoff', 'Acme Venues', 'acme', '/events/1']) {
    expect(body, `denial body must not contain "${leak}"`).not.toContain(leak);
  }
});

test('every 401 looks the same: missing, garbage, and unknown-but-valid-format tokens', async ({
  request,
  }) => {
  const missing = await request.get('/events');
  const garbage = await request.get('/events', {
    headers: { Authorization: 'Bearer definitely-not-a-uuid' },
  });
  const unknown = await request.get('/events', {
    headers: { Authorization: 'Bearer 00000000-0000-4000-8000-000000000000' },
  });

  const bodies = [missing, garbage, unknown].map((r) => {
    expect(r.status()).toBe(401);
    return r;
  });
  const texts = await Promise.all(bodies.map((r) => r.text()));
  expect(new Set(texts).size, 'all 401s share one body').toBe(1);
  expect(JSON.parse(texts[0]!)).toHaveProperty('error');
});

test('unknown routes and methods fail closed with JSON, never HTML or stack traces', async ({
  request,
  }) => {
  const token = await login(request, USERS.opAcme.email);
  const headers = bearer(token);

  for (const probe of [
    { method: 'DELETE', path: `/events/${EVENTS.acme}` },
    { method: 'PUT', path: `/events/${EVENTS.acme}` },
    { method: 'GET', path: `/events/${EVENTS.acme}/tickets` },
    { method: 'GET', path: '/admin/users' },
  ]) {
    const res = await request.fetch(probe.path, { method: probe.method, headers });
    expect(res.status(), `${probe.method} ${probe.path} is not a thing`).toBe(404);
    const body = await res.text();
    expect(() => JSON.parse(body), `${probe.method} ${probe.path} returns JSON`).not.toThrow();
    expect(body.toLowerCase()).not.toContain('<html');
  }
});
