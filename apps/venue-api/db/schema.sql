-- Multi-tenant schema: every user-visible row hangs off organizations.id.
-- The org_id columns are what the isolation suite (Phase 3) defends.

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
  role     TEXT NOT NULL CHECK (role IN ('operator', 'viewer'))
);

-- Demo-grade auth: a bearer token per login. No passwords on purpose.
CREATE TABLE IF NOT EXISTS sessions (
  token      TEXT PRIMARY KEY,
  user_id    INTEGER NOT NULL REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS events (
  id        INTEGER PRIMARY KEY,
  org_id    INTEGER NOT NULL REFERENCES organizations(id),
  name      TEXT NOT NULL,
  status    TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published')),
  starts_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS tickets (
  id       INTEGER PRIMARY KEY,
  event_id INTEGER NOT NULL REFERENCES events(id),
  kind     TEXT NOT NULL CHECK (kind IN ('ga', 'vip')),
  qty      INTEGER NOT NULL CHECK (qty > 0)
);
