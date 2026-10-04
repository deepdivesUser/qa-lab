/**
 * The same tables with every CHECK constraint dropped — what a careless
 * schema rebuild looks like. The data validator's enum/anomaly checks exist
 * for exactly this database: rows that a healthy schema would have refused.
 * Sensitivity specs plant defects here to prove those checks earn their keep.
 */
export const DRIFT_SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS organizations (
  id       INTEGER PRIMARY KEY,
  name     TEXT NOT NULL,
  slug     TEXT NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS users (
  id       INTEGER PRIMARY KEY,
  org_id   INTEGER NOT NULL REFERENCES organizations(id),
  email    TEXT NOT NULL UNIQUE,
  name     TEXT NOT NULL,
  role     TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS sessions (
  token      TEXT PRIMARY KEY,
  user_id    INTEGER NOT NULL REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS events (
  id        INTEGER PRIMARY KEY,
  org_id    INTEGER NOT NULL REFERENCES organizations(id),
  name      TEXT NOT NULL,
  status    TEXT NOT NULL DEFAULT 'draft',
  starts_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS tickets (
  id       INTEGER PRIMARY KEY,
  event_id INTEGER NOT NULL REFERENCES events(id),
  kind     TEXT NOT NULL,
  qty      INTEGER NOT NULL
);
`;
