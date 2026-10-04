import { test, expect } from '@playwright/test';
import { openDb } from '../../../apps/venue-api/src/db.ts';
import { runChecks, render } from '../src/validator.ts';
import { SEED_MANIFEST } from '../src/manifest.ts';

/**
 * Baseline: the freshly seeded dev database (the one the running server was
 * booted with) passes every data check. If this goes red after an innocent
 * change, the seed and the validator disagreed — reconcile them in one commit.
 */
test('freshly seeded database has zero data violations', () => {
  const db = openDb();
  try {
    const violations = runChecks(db);
    expect(violations, render(violations)).toEqual([]);
  } finally {
    db.close();
  }
});

test('row counts match the seed manifest', () => {
  const db = openDb();
  try {
    const count = (table: string) =>
      (db.prepare(`SELECT COUNT(*) AS n FROM ${table}`).get() as { n: number }).n;
    expect(count('organizations')).toBe(SEED_MANIFEST.orgs);
    expect(count('users')).toBe(SEED_MANIFEST.users);
    expect(count('events')).toBe(SEED_MANIFEST.events);
    expect(count('tickets')).toBe(SEED_MANIFEST.tickets);

    const byOrg = db.prepare(`
      SELECT o.slug, COUNT(e.id) AS n
        FROM organizations o LEFT JOIN events e ON e.org_id = o.id
       GROUP BY o.slug`).all() as { slug: string; n: number }[];
    const map = Object.fromEntries(byOrg.map((r) => [r.slug, r.n]));
    expect(map).toEqual({ ...SEED_MANIFEST.eventsByOrg });
  } finally {
    db.close();
  }
});
