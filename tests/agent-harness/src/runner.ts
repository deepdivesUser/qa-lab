/** Grading + reporting: run probes, record outcomes, write JSON + markdown. */
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Task } from './tasks/index.ts';
import { apiFor } from './http.ts';
import { bootSeededServer } from './server.ts';

export interface ProbeResult {
  name: string;
  pass: boolean;
  ms: number;
  error?: string;
}

export interface TaskResult {
  task: string;
  title: string;
  kind: string;
  startedAt: string;
  agent?: string;
  totalMs: number;
  probes: ProbeResult[];
  passed: number;
  failed: number;
  allPassed: boolean;
}

const resultsDir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'results');

export async function runTask(
  task: Task,
  opts: { agent?: string; agentTimeoutMs?: number } = {},
): Promise<TaskResult> {
  const startedAt = new Date().toISOString();
  const t0 = Date.now();
  const server = await bootSeededServer();
  const api = apiFor(server.base);

  if (opts.agent) {
    const { spawnSync } = await import('node:child_process');
    const repoRoot = path.resolve(resultsDir, '../../..');
    const proc = spawnSync(opts.agent, {
      shell: true,
      cwd: repoRoot,
      env: { ...process.env, PROMPT: task.prompt },
      timeout: opts.agentTimeoutMs ?? 600_000,
      stdio: 'inherit',
    });
    if (proc.error) {
      await server.stop();
      throw new Error(`agent command failed to start: ${proc.error.message}`);
    }
    // Server has been running while the agent edited code — the agent may
    // have restarted nothing; reboot so probes hit the NEW code.
    await server.stop();
  }

  // Grade against a server booted from the CURRENT tree (post-agent edits).
  const gradingServer = opts.agent ? await bootSeededServer() : server;
  const gradingApi = apiFor(gradingServer.base);

  const probes: ProbeResult[] = [];
  for (const probe of task.probes) {
    const p0 = Date.now();
    try {
      await probe.run(gradingApi);
      probes.push({ name: probe.name, pass: true, ms: Date.now() - p0 });
    } catch (err) {
      probes.push({
        name: probe.name,
        pass: false,
        ms: Date.now() - p0,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }
  await gradingServer.stop();

  const passed = probes.filter((p) => p.pass).length;
  const result: TaskResult = {
    task: task.id,
    title: task.title,
    kind: task.kind,
    startedAt,
    agent: opts.agent,
    totalMs: Date.now() - t0,
    probes,
    passed,
    failed: probes.length - passed,
    allPassed: passed === probes.length,
  };
  writeReport(result);
  return result;
}

function writeReport(result: TaskResult): void {
  mkdirSync(resultsDir, { recursive: true });
  const stamp = result.startedAt.replace(/[:.]/g, '-');
  const base = path.join(resultsDir, `${stamp}-${result.task}`);

  writeFileSync(`${base}.json`, JSON.stringify(result, null, 2));

  const rows = result.probes
    .map((p) => `| ${p.pass ? '✅' : '❌'} | ${p.name} | ${p.ms}ms${p.error ? ` — \`${p.error}\`` : ''} |`)
    .join('\n');
  const md = `# Harness report — ${result.task} (${result.kind})

- **Outcome:** ${result.allPassed ? 'ALL PASSED' : `${result.failed} failed / ${result.probes.length}`}
- **Started:** ${result.startedAt} · **Duration:** ${result.totalMs}ms
- **Agent:** ${result.agent ?? 'none (graded current tree)'}

| | probe | detail |
|---|---|---|
${rows}
`;
  writeFileSync(`${base}.md`, md);
}

export function printResult(r: TaskResult): void {
  const head = `${r.task} [${r.kind}] — ${r.passed}/${r.probes.length} probes passed`;
  console.log(r.allPassed ? `✅ ${head}` : `❌ ${head}`);
  for (const p of r.probes) {
    console.log(`   ${p.pass ? '✓' : '✗'} ${p.name}${p.error ? ` — ${p.error}` : ''}`);
  }
}
