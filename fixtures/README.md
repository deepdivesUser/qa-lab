# fixtures

Shared seeded data for all suites.

- `users.ts` — seeded credentials + event names; mirrors `apps/venue-api/src/seedData.ts` (regenerate with `npm run seed`).
- `api.ts` — API-driven fixtures (`login`, `createEvent`): session state created
  through the real API, so fixtures double as smoke coverage.

Row-level counts and cross-suite totals live in `tests/data/src/manifest.ts`,
which the data suite reconciles against both the database and the API.
