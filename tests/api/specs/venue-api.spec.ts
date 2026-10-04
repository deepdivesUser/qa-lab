import { test, expect } from '@playwright/test';
import { USERS } from '../../e2e/fixtures/users.ts';
import { login, bearer } from '../../e2e/fixtures/api.ts';

/**
 * Contract smoke for venue-api — status codes and response shapes, probed
 * straight at the boundary the UI can't be trusted to exercise. Deeper shape
 * guarantees live in schema-drift.spec.ts against ./contracts.
 */

test('GET /health is a 200 with the documented shape', async ({ request }) => {
  const res = await request.get('/health');
  expect(res.status()).toBe(200);
  expect(await res.json()).toEqual({ ok: true });
});

test('POST /auth/login returns a token and the user shape', async ({ request }) => {
  const res = await request.post('/auth/login', { data: { email: USERS.opAcme.email } });
  expect(res.status()).toBe(200);

  const body = await res.json();
  expect(body.token, 'token is a uuid').toMatch(
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
  );
  expect(body.user).toMatchObject({
    email: USERS.opAcme.email,
    role: 'operator',
    org: { name: USERS.opAcme.org },
  });
});

test('POST /auth/login rejects unknown email with 401 + error body', async ({ request }) => {
  const res = await request.post('/auth/login', { data: { email: 'nobody@nowhere.test' } });
  expect(res.status()).toBe(401);
  expect(await res.json()).toHaveProperty('error');
});

test('POST /auth/login rejects a missing email with 400, not 500', async ({ request }) => {
  const res = await request.post('/auth/login', { data: {} });
  expect(res.status()).toBe(400);
  expect(await res.json()).toHaveProperty('error');
});

test('GET /events without a token is a 401', async ({ request }) => {
  const res = await request.get('/events');
  expect(res.status()).toBe(401);
});

test('GET /events returns the documented list shape', async ({ request }) => {
  const token = await login(request, USERS.opAcme.email);
  const res = await request.get('/events', { headers: bearer(token) });
  expect(res.status()).toBe(200);

  const { events } = await res.json();
  expect(Array.isArray(events)).toBe(true);
  expect(events.length).toBeGreaterThan(0);
  for (const ev of events) {
    expect(ev).toMatchObject({
      id: expect.any(Number),
      name: expect.any(String),
      status: expect.stringMatching(/^(draft|published)$/),
      startsAt: expect.any(String),
      tickets: expect.any(Number),
    });
  }
});
