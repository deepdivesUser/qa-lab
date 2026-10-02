# Failure triage

How a red build gets investigated here — the same loop I'd run against
production signals, just with a smaller blast radius.

## The loop

1. **Reproduce locally first.** `npm run test:e2e` with `retries: 0`. If it's
   green locally, it's environment or timing — go to step 3 before touching code.
2. **Read the trace, not the screenshot.** First-retry traces are attached to
   CI artifacts (`.github/workflows/ci.yml` uploads them on failure).
3. **Check the server's JSON logs.** The SUT logs one line per request
   (`method`, `path`, `status`, `durationMs`). A 4xx you didn't expect or a
   slower-than-usual path usually points at the cause faster than the DOM does.
4. **Bisect the surface.** API-level probes (`request` context in specs) fail
   independently of the UI. If the API probe is red and the UI test is red,
   it's the service; if only the UI is red, it's the console.

## Case log

Format: symptom → root cause → fix → guard added. Appended as failures get
triaged; this is the paper trail that turns one-off debugging into regression
coverage.

<!-- entries follow -->

## 2026-10-02 — `console-view`/`create-form` never hid for viewers and logged-out users

- **Symptom:** two E2E failures — `unknown email is rejected` and `viewer cannot create`. Both
  asserted on elements that should be `hidden` but were rendered.
- **Root cause:** the `[hidden]` attribute sets `display: none` at UA-stylesheet specificity;
  `main { display: grid }` and `#create-section form { display: grid }` outranked it. The UI
  therefore rendered both views simultaneously; the login form just covered the console.
- **Fix:** one rule in `styles.css` — `[hidden] { display: none !important; }`.
- **Guard:** the two failing specs stay as-is; they are the regression coverage.
- **Lesson:** visibility bugs that CSS causes, tests catch — assert on semantic state
  (`hidden`), not on what happens to be on top.
