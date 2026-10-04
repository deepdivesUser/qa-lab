/** Build isolated, freshly seeded database files — one per test, no shared state. */
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { initSchema } from '../../../apps/venue-api/src/db.ts';
import { seedInto } from '../../../apps/venue-api/src/seedData.ts';
import { DRIFT_SCHEMA_SQL } from './driftSchema.ts';

export interface TempDb {
  db: DatabaseSync;
  file: string;
  close(): void;
}

/**
 * Foreign keys deliberately OFF here: the sensitivity specs need to insert
 * exactly the kind of row a healthy pipeline never produces (orphans, bad
 * enums) — with node:sqlite's default constraints on, SQLite would refuse to
 * model the defect at all.
 */
export function seededTempDb(opts: { schema?: 'strict' | 'drift' } = {}): TempDb {
  const dir = mkdtempSync(path.join(tmpdir(), 'qa-lab-data-'));
  const file = path.join(dir, 'venue.db');
  const db = new DatabaseSync(file, { enableForeignKeyConstraints: false });
  if (opts.schema === 'drift') db.exec(DRIFT_SCHEMA_SQL);
  else initSchema(db);
  seedInto(db);
  return {
    db,
    file,
    close() {
      db.close();
      rmSync(dir, { recursive: true, force: true });
    },
  };
}
