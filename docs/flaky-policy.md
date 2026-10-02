# Flaky test policy

A flaky test is worse than no test: it trains the team to ignore red, and it
hides real regressions in the noise. The rule set:

1. **Local runs get zero retries** (`retries: process.env.CI ? 1 : 0`). A test
   that only passes with retries is flaky by definition.
2. **CI gets one retry** as a concession to shared-runner jitter — with
   `trace: 'on-first-retry'` so the failure leaves evidence, not a shrug.
3. **Two strikes and you're quarantined.** A test that flakes twice in a week
   gets marked `test.fixme()` with a ticket link, not left to rot red.
4. **Fix or delete.** Quarantined tests get a decision within two weeks:
   fix the test, fix the product, or delete the check. "Waiting to see if it
   fixes itself" is not an option.
5. **No `waitForTimeout` in specs.** Waits are for conditions, not clocks.
   (Enforced in review; a lint rule can follow if it's ever needed.)
6. **Deterministic data only.** Every run starts from `npm run seed`; tests
   never depend on each other's leftovers. Unique names (`Date.now()`) make
   parallel-safe assertions trivial.
