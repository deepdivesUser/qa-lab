/**
 * SQL data validation — integrity, duplication, and anomaly checks that run
 * straight against storage. The API suite proves the boundary behaves; these
 * checks prove the data underneath didn't rot (bad transforms, hand-edited
 * rows, a rebuild that dropped a constraint).
 *
 * Checks return violations, not booleans: a failure must say which table and
 * which rows so triage starts at the data, not at the test.
 */
import type { DatabaseSync } from 'node:sqlite';

export interface Violation {
  check: string;
  table: string;
  rows: Record<string, unknown>[];
  hint: string;
}

const ENUMS = {
  'users.role': ['operator', 'viewer'],
  'events.status': ['draft', 'published'],
  'tickets.kind': ['ga', 'vip'],
} as const;

/** Sensible bounds for a demo-scale venue system — anomalies, not policy. */
const QTY_MAX = 100_000;
const DATE_MIN = '2000-01-01T00:00:00.000Z';
const DATE_MAX = '2100-01-01T00:00:00.000Z';

function rows(db: DatabaseSync, sql: string): Record<string, unknown>[] {
  return db.prepare(sql).all() as Record<string, unknown>[];
}

export function runChecks(db: DatabaseSync): Violation[] {
  const violations: Violation[] = [];
  const flag = (check: string, table: string, hint: string, rs: Record<string, unknown>[]) => {
    if (rs.length > 0) violations.push({ check, table, rows: rs, hint });
  };

  // --- referential integrity: no row may reference a missing parent ---
  flag('fk', 'tickets', 'ticket references a missing event', rows(db, `
    SELECT t.id, t.event_id FROM tickets t
    LEFT JOIN events e ON e.id = t.event_id
    WHERE e.id IS NULL`));
  flag('fk', 'events', 'event references a missing organization', rows(db, `
    SELECT e.id, e.org_id FROM events e
    LEFT JOIN organizations o ON o.id = e.org_id
    WHERE o.id IS NULL`));
  flag('fk', 'users', 'user references a missing organization', rows(db, `
    SELECT u.id, u.org_id FROM users u
    LEFT JOIN organizations o ON o.id = u.org_id
    WHERE o.id IS NULL`));
  flag('fk', 'sessions', 'session references a missing user', rows(db, `
    SELECT s.token, s.user_id FROM sessions s
    LEFT JOIN users u ON u.id = s.user_id
    WHERE u.id IS NULL`));

  // --- required content: NOT NULL columns must not hold empty strings ---
  flag('required', 'organizations', 'name or slug is empty', rows(db, `
    SELECT id, name, slug FROM organizations
    WHERE TRIM(name) = '' OR TRIM(slug) = ''`));
  flag('required', 'users', 'email or name is empty', rows(db, `
    SELECT id, email, name FROM users
    WHERE TRIM(email) = '' OR TRIM(name) = ''`));
  flag('required', 'events', 'name is empty', rows(db, `
    SELECT id, name FROM events WHERE TRIM(name) = ''`));

  // --- duplication: business keys must be unique where the model says so ---
  flag('duplicate', 'users', 'email reused by multiple users', rows(db, `
    SELECT email, COUNT(*) AS n FROM users GROUP BY email HAVING n > 1`));
  flag('duplicate', 'organizations', 'slug reused by multiple orgs', rows(db, `
    SELECT slug, COUNT(*) AS n FROM organizations GROUP BY slug HAVING n > 1`));
  flag('duplicate', 'events', 'same event name twice in one org', rows(db, `
    SELECT org_id, name, COUNT(*) AS n FROM events GROUP BY org_id, name HAVING n > 1`));

  // --- enum drift: catches a rebuilt schema that lost its CHECK constraints ---
  for (const [col, allowed] of Object.entries(ENUMS)) {
    const [table, column] = col.split('.') as [string, string];
    const list = allowed.map((v) => `'${v}'`).join(', ');
    flag('enum', table, `${col} outside ${allowed.join('|')}`, rows(db, `
      SELECT id, ${column} FROM ${table} WHERE ${column} NOT IN (${list})`));
  }

  // --- value anomalies: quantities and dates a healthy pipeline can't produce ---
  flag('anomaly', 'tickets', `qty <= 0 or qty > ${QTY_MAX}`, rows(db, `
    SELECT id, event_id, qty FROM tickets WHERE qty <= 0 OR qty > ${QTY_MAX}`));
  flag('anomaly', 'events', `starts_at outside ${DATE_MIN.slice(0, 4)}–${DATE_MAX.slice(0, 4)} or not ISO-8601`, rows(db, `
    SELECT id, starts_at FROM events
    WHERE starts_at NOT GLOB '[0-9][0-9][0-9][0-9]-[0-9][0-9]-[0-9][0-9]T*'
       OR starts_at < '${DATE_MIN}' OR starts_at > '${DATE_MAX}'`));

  return violations;
}

/** Human-readable one-line-per-violation rendering for logs and reports. */
export function render(violations: Violation[]): string {
  return violations
    .map((v) => `[${v.check}] ${v.table}: ${v.hint} — rows: ${JSON.stringify(v.rows.slice(0, 5))}`)
    .join('\n');
}
