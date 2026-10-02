/**
 * Seeded credentials — the single source of truth shared by every suite.
 * Mirrors apps/venue-api/src/seed.ts; regenerate with `npm run seed`.
 */
export const USERS = {
  opAcme: { email: 'op-acme@acmevenues.test', name: 'Ava Operator', org: 'Acme Venues' },
  viewerAcme: { email: 'viewer-acme@acmevenues.test', name: 'Vic Viewer', org: 'Acme Venues' },
  opBayline: { email: 'op-bayline@baylinedistricts.test', name: 'Bao Operator', org: 'Bayline Districts' },
  viewerBayline: { email: 'viewer-bayline@baylinedistricts.test', name: 'Bea Viewer', org: 'Bayline Districts' },
} as const;

/** Event names that exist for Acme after a fresh seed. */
export const ACME_EVENTS = ['Acme Summer Kickoff', 'Acme Night Market'] as const;

/** Event names that exist for Bayline after a fresh seed. */
export const BAYLINE_EVENTS = ['Bayline Food Hall Week'] as const;
