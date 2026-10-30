import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig, devices } from '@playwright/test';

const WEB_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
/** Its own port, never reused, so a stale dev server fails the run instead of being tested by mistake. */
const PORT = 5302;

/** The built site (vite build + vite preview), as it would be served: the smoke test reads the real stories. */
export default defineConfig({
  testDir: '.',
  outputDir: '../test-results',
  fullyParallel: false,
  workers: 1,
  reporter: [['list']],
  use: { baseURL: `http://localhost:${PORT}`, trace: 'retain-on-failure' },
  projects: [{ name: 'chromium', use: { ...devices['Pixel 7'] } }],
  webServer: {
    command: `pnpm exec vite build && pnpm exec vite preview --port ${PORT} --strictPort`,
    cwd: WEB_DIR,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: false,
    timeout: 120_000,
  },
});
