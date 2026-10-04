import { test, expect } from '@playwright/test';
import { openDb } from '../../../apps/venue-api/src/db.ts';
import { SEED_MANIFEST } from '../src/manifest.ts';
import { USERS } from '../../e2e/fixtures/users.ts';
import { login, bearer } from '../../e2e/fixtures/api.ts';

/**
 * Reconciliation: the API's view of the world and the database's view must
 * agree. This is the seam where "the endpoint works" and "the data is right"
 * meet — a query that silently drops a JOIN or a transform that loses rows
 * passes every endpoint-level test and still ships wrong numbers.
 */
test('GET /events ticket totals equal the SQL SUM per event', async ({ request }) => {
  const token = await login(request, USERS.opAcme.email);
  const res = await request.get('/events', { headers: { Authorization: `Bearer ${token}` } });
  expect(res.status()).toBe(200);
  const { events } = (await res.json()) as { events: { id: number; tickets: number }[] };

  const db = openDb();
  try {
    const sql = db.prepare(`
      SELECT e.id, COALESCE(SUM(t.qty), 0) AS tickets
        FROM events e LEFT JOIN tickets t ON t.event_id = e.id
       WHERE e.org_id = 1 GROUP BY e.id`).all() as { id: number; tickets: number }[];
    const sqlByld = new Map(sql.map((r) => [r.id, r.tickets]));

    expect(events).toHaveLength(sql.length);
    for (const ev of events) {
      expect(ev.tickets, `event ${ev.id} tickets via API vs SQL`).toBe(sqlByld.get(ev.id));
    }
  } finally {
    db.close();
  }
});

test('API event totals per org match the seed manifest', async ({ request }) => {
  const orgs: Array<[keyof typeof USERS, keyof typeof SEED_MANIFEST.eventsByOrg]> = [
    ['opAcme', 'acme'],
    ['opBayline', 'bayline'],
  ];
  for (const [userKey, orgKey] of orgs) {
    const token = await login(request, USERS[userKey].email);
    const res = await request.get('/events', { headers: bearer(token) });
    const { events } = (await res.json()) as { events: { id: number }[] };
    expect(events, `${orgKey} event count via API`).toHaveLength(SEED_MANIFEST.eventsByOrg[orgKey]);
  }
});

test('GET /me mirrors the users row exactly', async ({ request }) => {
  const db = openDb();
  try {
    const row = db.prepare(
      `SELECT u.id, u.email, u.name, u.role, u.org_id FROM users u WHERE u.email = ?`,
    ).get(USERS.viewerBayline.email) as {
      id: number; email: string; name: string; role: string; org_id: number;
    };

    const token = await login(request, USERS.viewerBayline.email);
    const res = await request.get('/me', { headers: bearer(token) });
    expect(res.status()).toBe(200);
    const me = (await res.json()) as {
      id: number; email: string; name: string; role: string; org: { id: number };
    };

    expect(me).toMatchObject({
      id: row.id, email: row.email, name: row.name, role: row.role, org: { id: row.org_id },
    });
  } finally {
    db.close();
  }
});
