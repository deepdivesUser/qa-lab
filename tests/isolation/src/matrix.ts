/**
 * The access matrix — every protected endpoint against every actor.
 *
 * Two rules decide most cells (see server.ts header):
 *   1. Anonymous → 401 everywhere except the public endpoints.
 *   2. Cross-tenant resource access → 404, never 403, so existence isn't leaked.
 *
 * The subtlety this table pins: for WRITES the role gate runs before the
 * org-scoped lookup, so a viewer gets 403 regardless of which org the event
 * belongs to. That ordering is deliberate — 403 here can only mean "you're
 * not an operator," so it reveals nothing about the resource. If that
 * ordering ever changes, this table changes in the same commit.
 */
import { USERS } from '../../e2e/fixtures/users.ts';

export type ActorId = 'anon' | 'viewerAcme' | 'opAcme' | 'viewerBayline' | 'opBayline';

export const ACTORS: Record<ActorId, { email?: string; org: 'acme' | 'bayline'; role: 'viewer' | 'operator' | 'none' }> = {
  anon: { org: 'acme', role: 'none' },
  viewerAcme: { email: USERS.viewerAcme.email, org: 'acme', role: 'viewer' },
  opAcme: { email: USERS.opAcme.email, org: 'acme', role: 'operator' },
  viewerBayline: { email: USERS.viewerBayline.email, org: 'bayline', role: 'viewer' },
  opBayline: { email: USERS.opBayline.email, org: 'bayline', role: 'operator' },
};

/** Event ids from the seed: 1,2 = acme; 3 = bayline. */
export const EVENTS = {
  acme: 1,
  acmeOther: 2,
  bayline: 3,
  nonexistent: 999_999,
} as const;

export interface MatrixRow {
  /** Route under probe, e.g. "GET /events/:id". */
  route: string;
  /** Path with the placeholder filled, e.g. "/events/3". */
  path: string;
  method: 'GET' | 'POST';
  body?: Record<string, unknown>;
  /** Expected status per actor. */
  expected: Record<ActorId, number>;
}

const VALID_EVENT = { name: 'Matrix Probe Event', startsAt: '2026-10-31T20:00:00Z' };
const VALID_TICKET = { kind: 'ga', qty: 10 };

export const MATRIX: MatrixRow[] = [
  {
    route: 'GET /me',
    path: '/me',
    method: 'GET',
    expected: { anon: 401, viewerAcme: 200, opAcme: 200, viewerBayline: 200, opBayline: 200 },
  },
  {
    route: 'GET /events',
    path: '/events',
    method: 'GET',
    expected: { anon: 401, viewerAcme: 200, opAcme: 200, viewerBayline: 200, opBayline: 200 },
  },
  {
    route: 'GET /events/:id (own org)',
    path: `/events/${EVENTS.acme}`,
    method: 'GET',
    expected: { anon: 401, viewerAcme: 200, opAcme: 200, viewerBayline: 404, opBayline: 404 },
  },
  {
    route: 'GET /events/:id (cross-org)',
    path: `/events/${EVENTS.bayline}`,
    method: 'GET',
    expected: { anon: 401, viewerAcme: 404, opAcme: 404, viewerBayline: 200, opBayline: 200 },
  },
  {
    route: 'GET /events/:id (nonexistent)',
    path: `/events/${EVENTS.nonexistent}`,
    method: 'GET',
    expected: { anon: 401, viewerAcme: 404, opAcme: 404, viewerBayline: 404, opBayline: 404 },
  },
  {
    route: 'POST /events',
    path: '/events',
    method: 'POST',
    body: VALID_EVENT,
    expected: { anon: 401, viewerAcme: 403, opAcme: 201, viewerBayline: 403, opBayline: 201 },
  },
  {
    route: 'POST /events/:id/tickets (own org)',
    path: `/events/${EVENTS.acmeOther}/tickets`,
    method: 'POST',
    body: VALID_TICKET,
    // Role gate first: viewer is 403 even cross-org (leaks nothing — see header).
    expected: { anon: 401, viewerAcme: 403, opAcme: 201, viewerBayline: 403, opBayline: 404 },
  },
  {
    route: 'POST /events/:id/tickets (cross-org)',
    path: `/events/${EVENTS.bayline}/tickets`,
    method: 'POST',
    body: VALID_TICKET,
    expected: { anon: 401, viewerAcme: 403, opAcme: 404, viewerBayline: 403, opBayline: 201 },
  },
  {
    route: 'POST /events/:id/tickets (nonexistent)',
    path: `/events/${EVENTS.nonexistent}/tickets`,
    method: 'POST',
    body: VALID_TICKET,
    expected: { anon: 401, viewerAcme: 403, opAcme: 404, viewerBayline: 403, opBayline: 404 },
  },
];
