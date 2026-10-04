import { defineConfig } from '@playwright/test';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT ?? 3100);

export default defineConfig({
  testDir: './specs',
  // Accepted matrix cells mutate the shared seeded database, and side-effect
  // specs assert exactly what did and didn't land — determinism beats speed
  // at ~50 cheap API calls.
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: [['list']],
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: 'on-first-retry',
  },
  outputDir: './test-results',
  webServer: {
    command: 'npm run seed && npm run dev',
    cwd: path.resolve(here, '../..'),
    url: `http://localhost:${PORT}/health`,
    reuseExistingServer: !process.env.CI,
    env: { PORT: String(PORT) },
    timeout: 60_000,
  },
});
