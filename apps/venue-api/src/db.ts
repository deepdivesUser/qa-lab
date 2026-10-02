import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
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
  const db = new DatabaseSync(DB_FILE);
  db.exec('PRAGMA foreign_keys = ON');
  return db;
}

export function initSchema(db: DatabaseSync): void {
  db.exec(readFileSync(path.join(here, '..', 'db', 'schema.sql'), 'utf8'));
}
