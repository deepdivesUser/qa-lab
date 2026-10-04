import { DatabaseSync } from 'node:sqlite';
import { mkdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));

/**
 * SQLite file for the current environment. Override with DATABASE_FILE to
 * point dev/stage/prod-like environments at separate databases (Phase 2
 * uses this for promotion checks).
 */
export const DB_FILE =
  process.env.DATABASE_FILE ?? path.join(here, '..', 'data', 'venue.db');

/**
 * Opens a fresh connection per call. Deliberate: tests re-seed by swapping
 * the file out from under a running server, so long-lived handles would go
 * stale. Opening SQLite is cheap at this scale; correctness beats cleverness.
 */
export function openDb(): DatabaseSync {
  // SQLite won't create missing parent dirs; a fresh clone has no data/ yet.
  mkdirSync(path.dirname(DB_FILE), { recursive: true });
  const db = new DatabaseSync(DB_FILE);
  db.exec('PRAGMA foreign_keys = ON');
  // Parallel connections (API requests, data-suite readers) share one file;
  // without a busy timeout a writer/reader collision fails loudly instead of waiting.
  db.exec('PRAGMA busy_timeout = 2000');
  return db;
}

export function initSchema(db: DatabaseSync): void {
  db.exec(readFileSync(path.join(here, '..', 'db', 'schema.sql'), 'utf8'));
}
