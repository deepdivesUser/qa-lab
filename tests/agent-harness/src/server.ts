/**
 * Boots a hermetic venue-api: ephemeral port, throwaway database, seeded
 * fresh. The agent harness never grades against a shared dev database —
 * every task run gets its own world, so runs are repeatable and parallel-safe.
 */
import { spawn, type ChildProcess } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const tsx = path.join(repoRoot, 'node_modules', '.bin', 'tsx');
const serverEntry = path.join(repoRoot, 'apps', 'venue-api', 'src', 'server.ts');
const seedEntry = path.join(repoRoot, 'apps', 'venue-api', 'src', 'seed.ts');

export interface LiveServer {
  port: number;
  base: string;
  stop(): Promise<void>;
}

async function waitHealthy(base: string, timeoutMs: number): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(`${base}/health`);
      if (res.ok) return;
    } catch {
      /* not up yet */
    }
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error(`venue-api did not become healthy within ${timeoutMs}ms`);
}

function stopChild(child: ChildProcess): Promise<void> {
  return new Promise((resolve) => {
    if (child.exitCode !== null) return resolve();
    child.once('exit', () => resolve());
    child.kill('SIGTERM'); // server.ts handles SIGTERM and exits cleanly
    setTimeout(() => {
      if (child.exitCode === null) child.kill('SIGKILL');
      resolve();
    }, 3000).unref();
  });
}

export async function bootSeededServer(): Promise<LiveServer> {
  const dir = mkdtempSync(path.join(tmpdir(), 'qa-lab-harness-'));
  const dbFile = path.join(dir, 'venue.db');
  const port = 3210 + (process.pid % 500);
  const base = `http://127.0.0.1:${port}`;

  const seed = spawn(tsx, [seedEntry], {
    cwd: repoRoot,
    env: { ...process.env, DATABASE_FILE: dbFile },
    stdio: 'pipe',
  });
  await new Promise<void>((resolve, reject) => {
    seed.once('exit', (code) => (code === 0 ? resolve() : reject(new Error('seed failed'))));
  });

  const server = spawn(tsx, [serverEntry], {
    cwd: repoRoot,
    env: { ...process.env, PORT: String(port), DATABASE_FILE: dbFile },
    stdio: 'pipe',
  });
  server.stderr?.on('data', (d) => process.stderr.write(`[sut] ${d}`));

  try {
    await waitHealthy(base, 30_000);
  } catch (err) {
    await stopChild(server);
    rmSync(dir, { recursive: true, force: true });
    throw err;
  }

  return {
    port,
    base,
    stop: async () => {
      await stopChild(server);
      rmSync(dir, { recursive: true, force: true });
    },
  };
}
