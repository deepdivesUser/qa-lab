# Test strategy

## What this suite is for

`apps/venue-api` is a deliberately small multi-tenant service. The test program
exists to hold three invariants in place as it evolves:

1. **Tenant isolation** — org-scoped reads/writes only; cross-tenant reads 404.
2. **Role enforcement** — viewers read, operators write, at the API boundary.
3. **Data integrity** — what goes in through the API is what comes out (Phase 2).

## What gets automated vs. tested manually

| Automated | Manual / exploratory |
|---|---|
| Anything a regression would break silently: auth, scoping, role gates, CRUD flows | Visual design, accessibility heuristics (automated a11y checks are planned), API misuse patterns worth promoting into probes |
| API contract behavior (status codes, shapes) | Performance/load characteristics — out of scope until the SUT grows |
| Data transformations and pipeline outputs (Phase 2) | |

Rule of thumb: automate the bug you'd be embarrassed to ship twice; write a
ticket for everything else. A test that costs more to maintain than the damage
it prevents gets deleted (see `flaky-policy.md`).

## Depth by risk

- **Isolation & permissions:** deepest coverage — highest blast radius, and the
  failure mode is a data leak, not a cosmetic bug. E2E smoke in the UI;
  exhaustive API probes in `tests/isolation/` (access matrix, denial
  uniformity, write side effects).
- **CRUD happy paths:** E2E-level only. The interesting failure modes live at
  boundaries (validation, auth), which are probed directly at the API.
- **Static UI:** intentionally thin. The demo UI exists to exercise flows, not
  to be pixel-tested.

## Environments

Phase 1 ran everything against one seeded SQLite database. Phase 2 makes the
environment seam real: `DATABASE_FILE` points dev/stage/prod-like environments
at separate database files, and `tests/data/specs/promotion.spec.ts` asserts
that every environment's seed produces identical schema and content — the
promotion check that migrations, seeds, and critical journeys stay aligned.
