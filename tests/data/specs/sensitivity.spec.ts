import { test, expect } from '@playwright/test';
import { seededTempDb, type TempDb } from '../src/tempDb.ts';
import { DRIFT_SCHEMA_SQL } from '../src/driftSchema.ts';
import { runChecks } from '../src/validator.ts';

/**
 * Sensitivity meta-tests: prove the validator actually catches each defect
 * class by planting that exact defect in an isolated copy and asserting it is
 * flagged. A check that can't fail is documentation, not a test — these specs
 * keep the validator honest as its check list grows.
 */
type Defect = {
  name: string;
  plant: (t: TempDb) => void;
  expectCheck: string;
  /** 'drift' plants into a schema whose CHECK constraints were lost in a
   * rebuild — the scenario the enum/anomaly checks exist for. */
  schema?: 'strict' | 'drift';
};

const DEFECTS: Defect[] = [
  {
    name: 'orphan ticket (event deleted out from under it)',
    expectCheck: 'fk',
    plant: ({ db }) => db.prepare('DELETE FROM events WHERE id = 1').run(),
  },
  {
    name: 'user pointed at a missing org',
    expectCheck: 'fk',
    plant: ({ db }) => db.prepare('UPDATE users SET org_id = 99 WHERE id = 1').run(),
  },
  {
    name: 'duplicate event name within one org',
    expectCheck: 'duplicate',
    plant: ({ db }) =>
      db.prepare(
        `INSERT INTO events (org_id, name, status, starts_at)
         VALUES (1, 'Acme Summer Kickoff', 'draft', '2026-09-01T10:00:00Z')`,
      ).run(),
  },
  {
    name: 'role outside the enum (constraint lost in a rebuild)',
    expectCheck: 'enum',
    schema: 'drift',
    plant: ({ db }) => db.prepare(`UPDATE users SET role = 'admin' WHERE id = 1`).run(),
  },
  {
    name: 'zero-quantity ticket (constraint lost in a rebuild)',
    expectCheck: 'anomaly',
    schema: 'drift',
    plant: ({ db }) =>
      db.prepare(`INSERT INTO tickets (event_id, kind, qty) VALUES (1, 'ga', 0)`).run(),
  },
  {
    name: 'unparseable starts_at',
    expectCheck: 'anomaly',
    plant: ({ db }) =>
      db.prepare(`UPDATE events SET starts_at = 'next tuesday' WHERE id = 1`).run(),
  },
  {
    name: 'empty event name',
    expectCheck: 'required',
    plant: ({ db }) => db.prepare(`UPDATE events SET name = '  ' WHERE id = 1`).run(),
  },
];

for (const defect of DEFECTS) {
  test(`validator catches: ${defect.name}`, () => {
    const t = seededTempDb({ schema: defect.schema ?? 'strict' });
    try {
      defect.plant(t);
      const violations = runChecks(t.db);
      const flagged = violations.filter((v) => v.check === defect.expectCheck);
      expect(flagged, `expected a "${defect.expectCheck}" violation`).not.toHaveLength(0);
    } finally {
      t.close();
    }
  });
}

test('validator stays quiet when nothing is wrong', () => {
  const t = seededTempDb();
  try {
    expect(runChecks(t.db)).toEqual([]);
  } finally {
    t.close();
  }
});
