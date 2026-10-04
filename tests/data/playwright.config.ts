import { defineConfig } from '@playwright/test';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT ?? 3100);

export default defineConfig({
  testDir: './specs',
  fullyParallel: true,
  retries: process.env.CI ? 1 : 0,
  reporter: [['list']],
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: 'on-first-retry',
  },
  outputDir: './test-results',
  // Reconciliation specs need the live API; integrity/anomaly specs read the
  // same seeded database the server booted with. One lifecycle, one truth.
  webServer: {
    command: 'npm run seed && npm run dev',
    cwd: path.resolve(here, '../..'),
    url: `http://localhost:${PORT}/health`,
    reuseExistingServer: !process.env.CI,
    env: { PORT: String(PORT) },
    timeout: 60_000,
  },
});
