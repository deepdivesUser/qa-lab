# tests/api

Contract smoke suite against `apps/venue-api` — status codes, auth boundaries,
and response shapes probed directly at the API (the layer the UI can't be
trusted to exercise). Runs via its own Playwright config with the same
seed-and-boot lifecycle as e2e.

- `specs/venue-api.spec.ts` — health/login/events contract smoke
- `docs/playwright-api-notes.md` — API-testing study notes this suite grew from

Phase 2 continues here: full contract + schema-drift coverage, GraphQL.
