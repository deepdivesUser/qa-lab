/**
 * Seed rows — the deterministic fixture every suite reconciles against.
 * Exported so data tests can build isolated database copies without
 * shelling out to `npm run seed` (fast, hermetic, same code path).
 */
import type { DatabaseSync } from 'node:sqlite';

export interface SeedCounts {
  orgs: number;
  users: number;
  events: number;
  tickets: number;
}

/** Idempotent-by-construction: wipes all tables, then inserts the fixture rows. */
export function seedInto(db: DatabaseSync): SeedCounts {
  db.exec('DELETE FROM sessions');
  db.exec('DELETE FROM tickets');
  db.exec('DELETE FROM events');
  db.exec('DELETE FROM users');
  db.exec('DELETE FROM organizations');

  db.exec('BEGIN');
  try {
    const run = (sql: string, ...params: (string | number)[]) =>
      db.prepare(sql).run(...params);

    run('INSERT INTO organizations (id, name, slug) VALUES (?, ?, ?)', 1, 'Acme Venues', 'acme');
    run('INSERT INTO organizations (id, name, slug) VALUES (?, ?, ?)', 2, 'Bayline Districts', 'bayline');

    const insertUser = 'INSERT INTO users (id, org_id, email, name, role) VALUES (?, ?, ?, ?, ?)';
    run(insertUser, 1, 1, 'op-acme@acmevenues.test', 'Ava Operator', 'operator');
    run(insertUser, 2, 1, 'viewer-acme@acmevenues.test', 'Vic Viewer', 'viewer');
    run(insertUser, 3, 2, 'op-bayline@baylinedistricts.test', 'Bao Operator', 'operator');
    run(insertUser, 4, 2, 'viewer-bayline@baylinedistricts.test', 'Bea Viewer', 'viewer');

    const insertEvent = 'INSERT INTO events (id, org_id, name, status, starts_at) VALUES (?, ?, ?, ?, ?)';
    run(insertEvent, 1, 1, 'Acme Summer Kickoff', 'published', '2026-07-18T18:00:00Z');
    run(insertEvent, 2, 1, 'Acme Night Market', 'draft', '2026-08-02T19:00:00Z');
    run(insertEvent, 3, 2, 'Bayline Food Hall Week', 'published', '2026-07-25T11:00:00Z');

    const insertTickets = 'INSERT INTO tickets (event_id, kind, qty) VALUES (?, ?, ?)';
    run(insertTickets, 1, 'ga', 500);
    run(insertTickets, 1, 'vip', 40);
    run(insertTickets, 3, 'ga', 300);
    db.exec('COMMIT');
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }

  const [{ n: orgs }, { n: users }, { n: events }, { n: tickets }] = [
    db.prepare('SELECT COUNT(*) AS n FROM organizations').get() as { n: number },
    db.prepare('SELECT COUNT(*) AS n FROM users').get() as { n: number },
    db.prepare('SELECT COUNT(*) AS n FROM events').get() as { n: number },
    db.prepare('SELECT COUNT(*) AS n FROM tickets').get() as { n: number },
  ];
  return { orgs, users, events, tickets };
}
