import { test, expect } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { initSchema } from '../../../apps/venue-api/src/db.ts';
import { seedInto } from '../../../apps/venue-api/src/seedData.ts';
import { runChecks } from '../src/validator.ts';

/**
 * Promotion checks (see docs/test-strategy.md): the same seed must produce
 * the same database in every environment. Seed drift between dev/stage/prod
 * is the classic "works on my machine" failure — this pins schema AND content
 * fingerprints across three independent seed runs, one of which goes through
 * the real `DATABASE_FILE` CLI path.
 */
interface EnvDb {
  env: string;
  file: string;
}

function fingerprint(db: DatabaseSync): { schema: string[]; data: Record<string, unknown[]> } {
  const schema = (
    db.prepare(
      `SELECT name, sql FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name`,
    ).all() as { name: string; sql: string }[]
  ).map((r) => `${r.name}: ${r.sql.replace(/\s+/g, ' ').trim()}`);

  const tables = ['organizations', 'users', 'events', 'tickets'];
  const data: Record<string, unknown[]> = {};
  for (const t of tables) {
    data[t] = db.prepare(`SELECT * FROM ${t} ORDER BY id`).all();
  }
  return { schema, data };
}

test('dev, stage, and prod seeds are byte-for-byte equivalent', () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'qa-lab-promo-'));
  const envs: EnvDb[] = ['dev', 'stage', 'prod'].map((env) => ({
    env,
    file: path.join(dir, `${env}.db`),
  }));
  try {
    for (const { file } of envs) {
      const db = new DatabaseSync(file);
      initSchema(db);
      seedInto(db);
      db.close();
    }

    const dbs = envs.map(({ file }) => new DatabaseSync(file));
    try {
      const prints = dbs.map(fingerprint);
      for (let i = 1; i < prints.length; i++) {
        expect(prints[i]!.schema, `schema drift: ${envs[i]!.env}`).toEqual(prints[0]!.schema);
        expect(prints[i]!.data, `data drift: ${envs[i]!.env}`).toEqual(prints[0]!.data);
      }
      for (const db of dbs) runChecks(db); // every env is also violation-free
    } finally {
      for (const db of dbs) db.close();
    }
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('DATABASE_FILE override seeds an identical database through the CLI', () => {
  const dir = mkdtempSync(path.join(tmpdir(), 'qa-lab-promo-cli-'));
  try {
    const file = path.join(dir, 'stage.db');
    execFileSync('npm', ['run', 'seed'], {
      cwd: path.resolve(import.meta.dirname, '../../..'),
      env: { ...process.env, DATABASE_FILE: file },
      stdio: 'pipe',
    });

    const db = new DatabaseSync(file);
    try {
      const cli = fingerprint(db);
      const refFile = path.join(dir, 'ref.db');
      const ref = new DatabaseSync(refFile);
      initSchema(ref);
      seedInto(ref);
      const refPrint = fingerprint(ref);
      ref.close();

      expect(cli.schema).toEqual(refPrint.schema);
      expect(cli.data).toEqual(refPrint.data);
    } finally {
      db.close();
    }
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
