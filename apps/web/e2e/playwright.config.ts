import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig, devices } from '@playwright/test';

const WEB_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
/** Its own port, never reused, so a stale dev server fails the run instead of being tested by mistake. */
const PORT = 5302;

/** A deployed site to check instead of a local build, e.g. E2E_BASE_URL=https://truyen.hoandat.com after a release. */
const DEPLOYED_URL = process.env.E2E_BASE_URL;

/** The built site (vite build + vite preview), as it would be served: the smoke test reads the real stories. */
export default defineConfig({
  testDir: '.',
  outputDir: '../test-results',
  fullyParallel: false,
  workers: 1,
  reporter: [['list']],
  use: { baseURL: DEPLOYED_URL ?? `http://localhost:${PORT}`, trace: 'retain-on-failure' },
  projects: [{ name: 'chromium', use: { ...devices['Pixel 7'] } }],
  webServer: DEPLOYED_URL !== undefined ? undefined : {
    command: `pnpm exec vite build && pnpm exec vite preview --port ${PORT} --strictPort`,
    cwd: WEB_DIR,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: false,
    timeout: 120_000,
  },
});
