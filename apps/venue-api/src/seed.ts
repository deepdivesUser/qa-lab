/**
 * Deterministic seed data — the shared fixture for every suite.
 * Two orgs, an operator + viewer each, overlapping-sounding event names on
 * purpose: a test that matches by substring instead of exact org scoping
 * will fail loudly here.
 */
import { rmSync } from 'node:fs';
import { openDb, initSchema, DB_FILE } from './db.ts';
import { seedInto } from './seedData.ts';
import { logger } from './logger.ts';

rmSync(DB_FILE, { force: true });
const db = openDb();
initSchema(db);
const counts = seedInto(db);
db.close();
logger.info('seed complete', { file: DB_FILE, ...counts });
