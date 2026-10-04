/**
 * The seed manifest — what a healthy, freshly seeded database must contain.
 * Two sources of truth reconciled: this manifest vs the actual rows (and, in
 * reconciliation.spec, the API's view vs this view). If the seed changes on
 * purpose, this file changes in the same commit — that's the contract.
 */
export const SEED_MANIFEST = {
  orgs: 2,
  users: 4,
  events: 3,
  tickets: 3,
  eventsByOrg: { acme: 2, bayline: 1 },
  ticketsByEvent: { 1: 540, 2: 0, 3: 300 }, // summed qty per event id
} as const;

export type SeedManifest = typeof SEED_MANIFEST;
