/**
 * Tasks define WHAT success looks like behaviorally. A task is a prompt plus
 * probes; an agent (or a human, or nothing at all) changes the code, and the
 * harness grades the RESULT by probing the running service — never by reading
 * the diff. Implementation style is not our contract; behavior is.
 */
import type { Api } from '../http.ts';
import { check, checkEqual, login } from '../http.ts';

export interface Probe {
  name: string;
  run: (api: Api) => Promise<void>;
}

export interface Task {
  id: string;
  title: string;
  kind: 'feature' | 'regression';
  /** Handed verbatim to the agent (README: how to wire one up). */
  prompt: string;
  /** Ordered; the first probe is the task's primary behavioral claim. */
  probes: Probe[];
}

const OP_ACME = 'op-acme@acmevenues.test';
const VIEWER_ACME = 'viewer-acme@acmevenues.test';
const OP_BAYLINE = 'op-bayline@baylinedistricts.test';
const ACME_DRAFT_EVENT = 2; // seed: 'Acme Night Market'
const ACME_PUBLISHED_EVENT = 1; // seed: 'Acme Summer Kickoff'
const BAYLINE_EVENT = 3;

async function eventIds(api: Api, token: string): Promise<number[]> {
  const res = await api.get('/events', token);
  const { events } = (await res.json()) as { events: { id: number }[] };
  return events.map((e) => e.id);
}

export const publishEvent: Task = {
  id: 'publish-event',
  title: 'PATCH /events/:id publishes a draft event under org+role rules',
  kind: 'feature',
  prompt: `In apps/venue-api, add "PATCH /events/:id" accepting {"status":"published"}.
Rules (mirror the existing endpoints' conventions):
- Only operators may call it; viewers get 403, anonymous get 401.
- Only for events in the caller's org; cross-org gets 404 with the standard
  {"error": ...} body (never 403 — see server.ts header for the two cases
  where 403 is correct).
- Publishing a draft returns 200 with the updated event; publishing an
  already-published event returns 400 {"error": ...}.
- A status value other than "published" returns 400.
Verify with: npm run typecheck && npm run test:isolation (must stay green).`,
  probes: [
    {
      name: 'operator publishes own-org draft → 200 and GET reflects it',
      async run(api) {
        const token = await login(api, OP_ACME);
        const res = await api.patch(`/events/${ACME_DRAFT_EVENT}`, { status: 'published' }, token);
        checkEqual(res.status, 200, 'PATCH publish status');
        const after = await api.get(`/events/${ACME_DRAFT_EVENT}`, token);
        const body = (await after.json()) as { status: string };
        checkEqual(body.status, 'published', 'event status after publish');
      },
    },
    {
      name: 'viewer gets 403, never a write',
      async run(api) {
        const token = await login(api, VIEWER_ACME);
        const res = await api.patch(`/events/${ACME_DRAFT_EVENT}`, { status: 'published' }, token);
        checkEqual(res.status, 403, 'viewer PATCH status');
      },
    },
    {
      name: 'cross-org operator gets 404 with the standard error body',
      async run(api) {
        const token = await login(api, OP_BAYLINE);
        const res = await api.patch(`/events/${ACME_DRAFT_EVENT}`, { status: 'published' }, token);
        checkEqual(res.status, 404, 'cross-org PATCH status');
        const body = (await res.json()) as { error?: string };
        check(typeof body.error === 'string', '404 body has error field');
      },
    },
    {
      name: 'anonymous gets 401',
      async run(api) {
        const res = await api.patch(`/events/${ACME_DRAFT_EVENT}`, { status: 'published' });
        checkEqual(res.status, 401, 'anonymous PATCH status');
      },
    },
    {
      name: 'already-published → 400',
      async run(api) {
        const token = await login(api, OP_ACME);
        const res = await api.patch(`/events/${ACME_PUBLISHED_EVENT}`, { status: 'published' }, token);
        checkEqual(res.status, 400, 'republish status');
      },
    },
    {
      name: 'invalid status value → 400',
      async run(api) {
        const token = await login(api, OP_ACME);
        const res = await api.patch(`/events/${ACME_DRAFT_EVENT}`, { status: 'live' }, token);
        checkEqual(res.status, 400, 'invalid status value');
      },
    },
  ],
};

export const statusFilter: Task = {
  id: 'status-filter',
  title: 'GET /events?status= filters own-org events by status',
  kind: 'feature',
  prompt: `In apps/venue-api, extend GET /events with an optional "status" query param.
Rules:
- "draft" or "published": return only that status, still org-scoped, same shape.
- Any other value: 400 {"error": ...}.
- No param: unchanged behavior.
Keep the isolation suite green: the filter must never widen org scoping.`,
  probes: [
    {
      name: 'operator filters to drafts only',
      async run(api) {
        const token = await login(api, OP_ACME);
        const res = await api.get('/events?status=draft', token);
        checkEqual(res.status, 200, 'draft filter status');
        const { events } = (await res.json()) as { events: { status: string; name: string }[] };
        check(events.length > 0, 'at least one draft exists for acme');
        check(events.every((e) => e.status === 'draft'), 'only drafts returned');
        check(events.some((e) => e.name === 'Acme Night Market'), 'known draft present');
      },
    },
    {
      name: 'published filter stays org-scoped',
      async run(api) {
        const token = await login(api, OP_BAYLINE);
        const res = await api.get('/events?status=published', token);
        checkEqual(res.status, 200, 'published filter status');
        const { events } = (await res.json()) as { events: { name: string }[] };
        checkEqual(events.length, 1, 'bayline has exactly one published event');
        checkEqual(events[0]!.name, 'Bayline Food Hall Week', 'bayline published event');
      },
    },
    {
      name: 'invalid status → 400 error body',
      async run(api) {
        const token = await login(api, OP_ACME);
        const res = await api.get('/events?status=live', token);
        checkEqual(res.status, 400, 'invalid status filter');
        const body = (await res.json()) as { error?: string };
        check(typeof body.error === 'string', '400 body has error field');
      },
    },
    {
      name: 'no param: unchanged behavior',
      async run(api) {
        const token = await login(api, OP_ACME);
        const res = await api.get('/events', token);
        checkEqual(res.status, 200, 'unfiltered status');
        const { events } = (await res.json()) as { events: { id: number }[] };
        checkEqual(events.length, 2, 'all acme events still returned');
      },
    },
  ],
};

export const regressionFloor: Task = {
  id: 'regression-floor',
  title: 'Core invariants any healthy tree must keep',
  kind: 'regression',
  prompt: '(regression task — no prompt; probes grade the current tree)',
  probes: [
    {
      name: 'health',
      async run(api) {
        const res = await api.get('/health');
        checkEqual(res.status, 200, 'health status');
      },
    },
    {
      name: 'login issues a token for a seeded operator',
      async run(api) {
        const token = await login(api, OP_ACME);
        check(token.length > 10, 'token looks like a token');
      },
    },
    {
      name: 'event lists are org-scoped',
      async run(api) {
        const acme = await login(api, OP_ACME);
        const bayline = await login(api, OP_BAYLINE);
        const acmeIds = await eventIds(api, acme);
        const baylineIds = await eventIds(api, bayline);
        checkEqual(acmeIds.length, 2, 'acme sees exactly its events');
        checkEqual(baylineIds.length, 1, 'bayline sees exactly its events');
        check(
          acmeIds.every((id) => !baylineIds.includes(id)),
          'no event id crosses orgs',
        );
      },
    },
    {
      name: 'cross-org read is 404, identical to nonexistent id',
      async run(api) {
        const token = await login(api, OP_ACME);
        const cross = await api.get(`/events/${BAYLINE_EVENT}`, token);
        const missing = await api.get('/events/999999', token);
        checkEqual(cross.status, 404, 'cross-org status');
        checkEqual(cross.text, missing.text, 'cross-org 404 body equals nonexistent 404 body');
      },
    },
    {
      name: 'viewer cannot write',
      async run(api) {
        const token = await login(api, VIEWER_ACME);
        const res = await api.post('/events', { name: 'X', startsAt: '2026-12-01T10:00:00Z' }, token);
        checkEqual(res.status, 403, 'viewer POST /events status');
      },
    },
    {
      name: 'ticket totals reconcile with the seed',
      async run(api) {
        const token = await login(api, OP_ACME);
        const res = await api.get('/events', token);
        const { events } = (await res.json()) as { events: { name: string; tickets: number }[] };
        const kickoff = events.find((e) => e.name === 'Acme Summer Kickoff');
        checkEqual(kickoff?.tickets, 540, 'Summer Kickoff totals (500 ga + 40 vip)');
      },
    },
  ],
};
