import { test, expect, type APIRequestContext } from '@playwright/test';
import { EVENTS } from '../src/matrix.ts';
import { login, bearer, createEvent } from '../../e2e/fixtures/api.ts';
import { USERS } from '../../e2e/fixtures/users.ts';

/**
 * Side-effect probes: a denied request that still writes is worse than one
 * that leaks — each rejection is verified to leave zero rows behind, and each
 * accepted write is verified to land in the caller's org and nowhere else.
 *
 * Names are unique per test, and state assertions compare before/after
 * snapshots rather than absolute seed values, so parallel-accepted writes
 * from other probes can never mask or fake a result.
 */
const run = Math.random().toString(36).slice(2, 8);

async function eventNames(request: APIRequestContext, token: string): Promise<string[]> {
  const res = await request.get('/events', { headers: bearer(token) });
  const { events } = (await res.json()) as { events: { name: string }[] };
  return events.map((e) => e.name);
}

test('viewer and anonymous POST /events rejections leave no rows', async ({ request }) => {
  const opToken = await login(request, USERS.opAcme.email);
  const before = await eventNames(request, opToken);

  const viewerToken = await login(request, USERS.viewerAcme.email);
  const asViewer = await request.post('/events', {
    data: { name: `Ghost ${run} viewer`, startsAt: '2026-12-01T18:00:00Z' },
    headers: bearer(viewerToken),
  });
  const asAnon = await request.post('/events', {
    data: { name: `Ghost ${run} anon`, startsAt: '2026-12-01T18:00:00Z' },
  });

  expect(asViewer.status()).toBe(403);
  expect(asAnon.status()).toBe(401);

  const after = await eventNames(request, opToken);
  expect(after, 'no ghost events landed').toEqual(before);
});

test('operator cross-org ticket rejection leaves the other org untouched', async ({ request }) => {
  const baylineToken = await login(request, USERS.opBayline.email);
  const ticketsFor = async () => {
    const list = await request.get('/events', { headers: bearer(baylineToken) });
    const { events } = (await list.json()) as { events: { name: string; tickets: number }[] };
    return events.find((e) => e.name === 'Bayline Food Hall Week')!.tickets;
  };
  const before = await ticketsFor();

  // acme operator tries to attach tickets to a bayline event
  const acmeToken = await login(request, USERS.opAcme.email);
  const res = await request.post(`/events/${EVENTS.bayline}/tickets`, {
    data: { kind: 'ga', qty: 5 },
    headers: bearer(acmeToken),
  });
  expect(res.status()).toBe(404);

  const after = await ticketsFor();
  expect(after, 'bayline totals unchanged by the rejected write').toBe(before);
});

test('a crafted payload cannot stamp an event into another org', async ({ request }) => {
  const acmeToken = await login(request, USERS.opAcme.email);

  // Even if a client tries to specify org_id, creation must stamp the caller's org.
  const res = await request.post('/events', {
    data: { name: `Forged ${run}`, startsAt: '2026-12-01T18:00:00Z', org_id: 2 },
    headers: bearer(acmeToken),
  });
  expect(res.status()).toBe(201);
  const created = (await res.json()) as { org_id?: number };
  expect(created.org_id, 'server-assigned org, never client-supplied').toBe(1);

  const baylineToken = await login(request, USERS.opBayline.email);
  const baylineNames = await eventNames(request, baylineToken);
  expect(baylineNames, 'forged event never appears in bayline').not.toContain(`Forged ${run}`);
});

test('accepted writes land exactly where they should', async ({ request }) => {
  const acmeToken = await login(request, USERS.opAcme.email);
  const created = await createEvent(request, acmeToken, {
    name: `Landed ${run}`,
    startsAt: '2026-12-24T20:00:00Z',
  });
  expect(created.status).toBe('draft');

  const acmeNames = await eventNames(request, acmeToken);
  expect(acmeNames).toContain(`Landed ${run}`);

  const baylineToken = await login(request, USERS.opBayline.email);
  const baylineNames = await eventNames(request, baylineToken);
  expect(baylineNames).not.toContain(`Landed ${run}`);
});
