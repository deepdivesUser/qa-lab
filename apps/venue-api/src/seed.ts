/**
 * Deterministic seed data — the shared fixture for every suite.
 * Two orgs, an operator + viewer each, overlapping-sounding event names on
 * purpose: a test that matches by substring instead of exact org scoping
 * will fail loudly here.
 */
import { rmSync } from 'node:fs';
import { openDb, initSchema, DB_FILE } from './db.ts';
import { logger } from './logger.ts';

rmSync(DB_FILE, { force: true });
const db = openDb();
initSchema(db);

// node:sqlite has no .transaction() helper — explicit begin/commit with rollback.
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

const [{ orgs }, { users }, { events }] = [
  db.prepare('SELECT COUNT(*) AS orgs FROM organizations').get() as { orgs: number },
  db.prepare('SELECT COUNT(*) AS users FROM users').get() as { users: number },
  db.prepare('SELECT COUNT(*) AS events FROM events').get() as { events: number },
];
db.close();
logger.info('seed complete', { file: DB_FILE, orgs, users, events });
