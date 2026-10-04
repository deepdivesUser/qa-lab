# qa-lab — a working test program, not a snippet collection

A small multi-tenant **venue operations demo app** (the system under test) wrapped in a
full quality program: E2E, API, data-integrity, security/isolation, and AI-agent-harness
testing, wired into GitHub Actions quality gates.

The point is to show judgment — what to automate, how to keep a suite healthy, and how
tests stay useful as a product grows — not just that I can write a selector.

| Folder | Skill it demonstrates | Status |
|---|---|---|
| `apps/venue-api/` | TypeScript service, multi-tenant by design (org-scoped queries, role checks), SQLite, structured request logging | ✅ Phase 1 |
| `tests/e2e/` | Playwright + TypeScript, page objects, seeded data, webServer lifecycle | ✅ Phase 1 |
| `.github/workflows/ci.yml` | GitHub Actions quality gates: typecheck → boot check → E2E, artifacts on failure | ✅ Phase 1 |
| `fixtures/` | Seeded test data shared across suites (grows in Phase 2 with factories) | ✅ starter |
| `docs/` | Test strategy (automate vs. manual, risk-based) and flaky-test policy | ✅ starter |
| `observability/` | Failure triage notes + structured logging conventions in the SUT | ✅ starter |
| `tests/api/` | API contract smoke + checked-in JSON-Schema contracts (`contracts/`) guarded against drift; GraphQL on the Phase 5 shortlist | ✅ Phase 2 |
| `tests/data/` | SQL data validation: FK integrity, duplicates, anomalies, constraint-drift detection + API↔DB reconciliation + dev/stage/prod promotion checks | ✅ Phase 2 |
| `tests/isolation/` | Deep tenant-isolation & permission probes (IDOR-style): full endpoint × role × org matrix, denial-uniformity and side-effect checks | ✅ Phase 3 |
| `tests/agent-harness/` | Repeatable harness for coding agents (Claude Code/Cursor): seeded env, behavioral probes, graded results | ✅ Phase 4 |

## Run it

```bash
npm install
npm run seed          # reset + seed the SQLite database (2 orgs, users, events, tickets)
npm run dev           # boot the API + operator console on http://localhost:3100
npm run test:api       # contract smoke + schema-drift guards
npm run test:data      # SQL integrity + API<->DB reconciliation + promotion checks
npm run test:isolation # full access matrix + non-leak probes
npm run test:e2e      # run the Playwright browser suite (auto-seeds a fresh DB, boots the app)
npm run harness:self-check # verify the agent-harness machinery
```

Requires Node ≥ 22.5 (`node:sqlite`). Playwright browsers: `npx playwright install chromium`.

## Domain model (deliberately small)

Two organizations (**Acme Venues**, **Bayline Districts**) share one database. Users have a
role (`operator` or `viewer`) scoped to their org. Every data query filters by `org_id`,
and cross-tenant reads return 404 rather than 403 so existence isn't leaked — the kind of
behavior the isolation suite (Phase 3) holds in place.

Login is email-only on purpose: this is a test target, not a product. The auth surface
that matters here is *scoping and role enforcement*, and that's what's under test.

## Conventions

- Test code is production code: strict TypeScript everywhere, `tsc --noEmit` is a CI gate.
- Tests rely on seeded, deterministic data (`fixtures/`) — never on leftovers from a previous run.
- Failures should leave a trail: the API logs JSON lines to stdout; triage notes go in `observability/`.
