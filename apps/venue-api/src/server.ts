/**
 * venue-api — a small multi-tenant service to test against.
 *
 * Multi-tenancy rules the suites defend:
 *   1. Every data query filters by the caller's org_id.
 *   2. Cross-tenant reads 404 (never 403) so existence isn't leaked.
 *   3. Writes require the 'operator' role; viewers are read-only.
 */
import express, { type Request, type Response, type NextFunction } from 'express';
import { randomUUID } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { openDb } from './db.ts';
import { logger } from './logger.ts';

const here = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT ?? 3100);

type Role = 'operator' | 'viewer';
interface AuthUser {
  id: number;
  orgId: number;
  orgName: string;
  email: string;
  name: string;
  role: Role;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

const app = express();
app.use(express.json());

// --- request logging: one JSON line per request, duration included ---
app.use((req: Request, res: Response, next: NextFunction) => {
  const start = performance.now();
  res.on('finish', () => {
    logger.info('request', {
      method: req.method,
      path: req.path,
      status: res.statusCode,
      durationMs: Math.round(performance.now() - start),
    });
  });
  next();
});

app.get('/health', (_req, res) => {
  res.json({ ok: true });
});

// --- auth ---
app.post('/auth/login', (req, res) => {
  const email = typeof req.body?.email === 'string' ? req.body.email.trim() : '';
  if (!email) return res.status(400).json({ error: 'email is required' });

  const db = openDb();
  try {
    const user = db.prepare(
      `SELECT u.id, u.org_id, u.email, u.name, u.role, o.name AS org_name
         FROM users u JOIN organizations o ON o.id = u.org_id
        WHERE u.email = ?`,
    ).get(email) as
      | { id: number; org_id: number; email: string; name: string; role: Role; org_name: string }
      | undefined;
    if (!user) return res.status(401).json({ error: 'unknown email' });

    const token = randomUUID();
    db.prepare('INSERT INTO sessions (token, user_id) VALUES (?, ?)').run(token, user.id);
    res.json({
      token,
      user: {
        id: user.id, email: user.email, name: user.name, role: user.role,
        org: { id: user.org_id, name: user.org_name },
      },
    });
  } finally {
    db.close();
  }
});

function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const header = req.headers.authorization ?? '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';
  if (!token) { res.status(401).json({ error: 'missing bearer token' }); return; }

  const db = openDb();
  try {
    const user = db.prepare(
      `SELECT u.id, u.org_id, u.email, u.name, u.role, o.name AS org_name
         FROM sessions s
         JOIN users u ON u.id = s.user_id
         JOIN organizations o ON o.id = u.org_id
        WHERE s.token = ?`,
    ).get(token) as
      | { id: number; org_id: number; email: string; name: string; role: Role; org_name: string }
      | undefined;
    db.close();
    if (!user) { res.status(401).json({ error: 'invalid token' }); return; }
    req.user = {
      id: user.id, orgId: user.org_id, orgName: user.org_name,
      email: user.email, name: user.name, role: user.role,
    };
    next();
  } catch (err) {
    db.close();
    throw err;
  }
}

function requireOperator(req: Request, res: Response, next: NextFunction): void {
  if (req.user?.role !== 'operator') {
    res.status(403).json({ error: 'operator role required' });
    return;
  }
  next();
}

// --- current user ---
app.get('/me', requireAuth, (req, res) => {
  const { id, email, name, role, orgId, orgName } = req.user!;
  res.json({ id, email, name, role, org: { id: orgId, name: orgName } });
});

// --- events: org-scoped by construction ---
app.get('/events', requireAuth, (req, res) => {
  const db = openDb();
  try {
    const rows = db.prepare(
      `SELECT e.id, e.name, e.status, e.starts_at AS startsAt,
              COALESCE(SUM(t.qty), 0) AS tickets
         FROM events e
         LEFT JOIN tickets t ON t.event_id = e.id
        WHERE e.org_id = ?
        GROUP BY e.id
        ORDER BY e.starts_at`,
    ).all(req.user!.orgId);
    res.json({ events: rows });
  } finally {
    db.close();
  }
});

app.post('/events', requireAuth, requireOperator, (req, res) => {
  const name = typeof req.body?.name === 'string' ? req.body.name.trim() : '';
  const startsAt = typeof req.body?.startsAt === 'string' ? req.body.startsAt : '';
  if (!name) return res.status(400).json({ error: 'name is required' });
  if (Number.isNaN(Date.parse(startsAt))) {
    return res.status(400).json({ error: 'startsAt must be a valid date' });
  }

  const db = openDb();
  try {
    const info = db.prepare(
      'INSERT INTO events (org_id, name, status, starts_at) VALUES (?, ?, ?, ?)',
    ).run(req.user!.orgId, name, 'draft', new Date(startsAt).toISOString());
    const created = db.prepare('SELECT * FROM events WHERE id = ?').get(
      Number(info.lastInsertRowid),
    );
    res.status(201).json(created);
  } finally {
    db.close();
  }
});

// Rule 2 in action: cross-tenant reads 404, not 403.
app.get('/events/:id', requireAuth, (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) return res.status(400).json({ error: 'invalid id' });

  const db = openDb();
  try {
    const event = db.prepare(
      'SELECT * FROM events WHERE id = ? AND org_id = ?',
    ).get(id, req.user!.orgId);
    if (!event) return res.status(404).json({ error: 'not found' });
    res.json(event);
  } finally {
    db.close();
  }
});

app.post('/events/:id/tickets', requireAuth, requireOperator, (req, res) => {
  const id = Number(req.params.id);
  const kind = req.body?.kind;
  const qty = Number(req.body?.qty);
  if (!Number.isInteger(id)) return res.status(400).json({ error: 'invalid id' });
  if (kind !== 'ga' && kind !== 'vip') {
    return res.status(400).json({ error: 'kind must be ga or vip' });
  }
  if (!Number.isInteger(qty) || qty < 1 || qty > 5000) {
    return res.status(400).json({ error: 'qty must be an integer 1-5000' });
  }

  const db = openDb();
  try {
    const event = db.prepare(
      'SELECT id FROM events WHERE id = ? AND org_id = ?',
    ).get(id, req.user!.orgId);
    if (!event) return res.status(404).json({ error: 'not found' });
    db.prepare('INSERT INTO tickets (event_id, kind, qty) VALUES (?, ?, ?)').run(id, kind, qty);
    res.status(201).json({ ok: true });
  } finally {
    db.close();
  }
});

// --- operator console (static) ---
app.use(express.static(path.join(here, '..', 'public')));

app.use((_req: Request, res: Response) => {
  res.status(404).json({ error: 'not found' });
});

const server = app.listen(PORT, () => {
  logger.info('venue-api listening', { port: PORT });
});

for (const sig of ['SIGINT', 'SIGTERM'] as const) {
  process.on(sig, () => {
    server.close(() => process.exit(0));
  });
}
