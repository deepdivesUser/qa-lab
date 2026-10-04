#!/usr/bin/env tsx
/**
 * qa-lab agent harness CLI.
 *
 * Modes:
 *   --self-check                 CI mode: proves the harness machinery works.
 *                                Regression task must be green; feature tasks'
 *                                probes must execute (and their primary probe
 *                                must fail — the feature isn't implemented).
 *   --task <id> [--agent <cmd>]  Grade a task against the current tree,
 *                                optionally letting <cmd> implement it first.
 *                                Exit 0 iff every probe passes.
 *
 * Agent commands run in the repo root with $PROMPT set to the task prompt.
 */
import { runTask, printResult } from '../src/runner.ts';
import { publishEvent, statusFilter, regressionFloor } from '../src/tasks/index.ts';

const TASKS = [publishEvent, statusFilter, regressionFloor];

const args = process.argv.slice(2);
const flag = (name: string): string | undefined => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : undefined;
};

async function main(): Promise<number> {
  if (args.includes('--self-check')) {
    console.log('harness self-check: every task graded against the unmodified tree\n');
    let ok = true;

    for (const task of TASKS) {
      const result = await runTask(task);
      printResult(result);
      console.log('');

      if (task.kind === 'regression') {
        if (!result.allPassed) ok = false; // the floor MUST hold
      } else {
        // Feature not implemented: probes must still have executed, and the
        // primary behavioral claim must fail (proving the probe can detect
        // absence — a probe that passes on an unimplemented feature is broken).
        const primary = result.probes[0]!;
        const executed = result.probes.every((p) => p.pass || p.error);
        if (!executed || primary.pass) ok = false;
      }
    }
    console.log(ok ? 'self-check: harness machinery verified' : 'self-check: FAILED');
    return ok ? 0 : 1;
  }

  const taskId = flag('--task');
  if (!taskId) {
    console.error('usage: harness.ts --self-check | --task <id> [--agent <cmd>]');
    console.error(`tasks: ${TASKS.map((t) => t.id).join(', ')}`);
    return 2;
  }
  const task = TASKS.find((t) => t.id === taskId);
  if (!task) {
    console.error(`unknown task "${taskId}" — known: ${TASKS.map((t) => t.id).join(', ')}`);
    return 2;
  }

  const agent = flag('--agent');
  if (!agent && task.kind === 'feature') {
    console.log(`note: grading "${taskId}" with no agent — features are unimplemented, expect red.\n`);
  }
  const result = await runTask(task, { agent });
  printResult(result);
  return result.allPassed ? 0 : 1;
}

main()
  .then((code) => process.exit(code))
  .catch((err) => {
    console.error(`harness error: ${err instanceof Error ? err.message : err}`);
    process.exit(2);
  });
