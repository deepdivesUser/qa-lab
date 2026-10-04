# tests/agent-harness

A repeatable harness for grading coding-agent (or human) work on this repo
**behaviorally**: each task is a prompt plus API probes, and success is
decided by probing the running service — never by reading the diff.
Implementation style is not the contract; behavior is.

## Why behavioral grading

- Diff-based grading rewards code that *looks* right; probes catch the
  cross-org 404 that became a 403, the validation that disappeared, the
  filter that quietly widened org scoping.
- The same grade applies to Claude Code, Cursor, a teammate, or a refactor —
  the harness doesn't care who (or what) made the change.
- Every run is hermetic: ephemeral port, throwaway seeded database, fresh
  boot. Runs are repeatable and comparable.

## Usage

```bash
# CI / sanity: prove the machinery (regression floor green, feature
# probes can detect absence). Exits nonzero if the harness is broken.
npm run harness:self-check

# Grade the current tree against a task (no agent).
npx tsx tests/agent-harness/bin/harness.ts --task regression-floor

# Let an agent implement a task, then grade it. $PROMPT is the task prompt.
npx tsx tests/agent-harness/bin/harness.ts --task publish-event \
  --agent 'claude -p "$PROMPT" --allowedTools "Read Edit Write Bash(npm run typecheck)"'
```

Reports land in `results/` (gitignored) as JSON + markdown: one row per
probe, pass/fail, duration, and the exact assertion message on failure.

## Tool permissions for agents

The harness runs whatever command you give it — constrain the agent the way
you'd constrain a contractor:

- **Read/Edit/Write** the repo, plus **Bash** limited to
  `npm run typecheck`, `npm run test:isolation`, `npm run seed`.
- No network, no `git push`, no commits — the harness grades the working
  tree as the agent leaves it.
- Run in a scratch clone or a branch: grading reboots the server from the
  current tree, so uncommitted changes are exactly what gets graded.

## Adding a task

1. Add a `Task` to `src/tasks/index.ts`: id, title, kind
   (`feature` = someone must implement it; `regression` = must always pass),
   the prompt an agent receives, and ordered probes. The **first probe is the
   task's primary behavioral claim** — self-check asserts it fails while the
   feature is unimplemented (a probe that can't fail is documentation, not a
   test).
2. Probes get an `Api` client against a freshly seeded server and fail by
   throwing — the message becomes the report row.
3. `npm run harness:self-check` must stay green: regression tasks pass,
   feature tasks' probes execute cleanly and detect absence.

## Task library

| Task | Kind | Claim |
|---|---|---|
| `publish-event` | feature | `PATCH /events/:id` publishes drafts under org+role rules |
| `status-filter` | feature | `GET /events?status=` filters without widening org scoping |
| `regression-floor` | regression | core invariants (scoping, 404 uniformity, role gates, reconciliation) |

Both feature tasks were validated by implementing them, grading green (4/4,
6/6 probes), and reverting — the probes are known to pass on real solutions
and fail on their absence.
