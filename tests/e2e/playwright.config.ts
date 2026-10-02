import { defineConfig } from '@playwright/test';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, '../..');
const PORT = Number(process.env.PORT ?? 3100);

export default defineConfig({
  testDir: './specs',
  fullyParallel: true,
  retries: process.env.CI ? 1 : 0, // see docs/flaky-policy.md — retries are a CI concession, not a fix
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  outputDir: './test-results',
  // Lifecycle owned by the config: fresh seed + boot before the run, so tests
  // never depend on state left behind by a previous run or a dev session.
  webServer: {
    command: 'npm run seed && npm run dev',
    cwd: repoRoot,
    url: `http://localhost:${PORT}/health`,
    reuseExistingServer: !process.env.CI,
    env: { PORT: String(PORT) },
    timeout: 60_000,
  },
});
