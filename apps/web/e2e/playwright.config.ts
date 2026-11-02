import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig, devices } from '@playwright/test';
import { API_PORT, DEPLOYED_URL, E2E_CLIENT_SECRET, FAKE_IDP_PORT, WEB_PORT } from './e2e-env';

const WEB_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SERVER_DIR = path.resolve(WEB_DIR, '../server');

/**
 * The built site (vite build + vite preview), as it would be served: the smoke test reads the real stories. Next to it
 * the real API (apps/server, PGlite in memory) against a test-only IdP, behind the preview's /api and /auth proxy as
 * behind nginx. Ports are fixed and the servers are never reused, so a stale dev server fails the run instead of being
 * tested by mistake.
 */
export default defineConfig({
  testDir: '.',
  outputDir: '../test-results',
  fullyParallel: false,
  workers: 1,
  reporter: [['list']],
  use: { baseURL: DEPLOYED_URL ?? `http://localhost:${WEB_PORT}`, trace: 'retain-on-failure' },
  projects: [{ name: 'chromium', use: { ...devices['Pixel 7'] } }],
  webServer:
    DEPLOYED_URL !== undefined
      ? undefined
      : [
          {
            command: 'pnpm exec tsx e2e/fake-idp-server.ts',
            cwd: WEB_DIR,
            url: `http://127.0.0.1:${FAKE_IDP_PORT}/.well-known/openid-configuration`,
            reuseExistingServer: false,
          },
          {
            command: 'pnpm exec tsx src/server.ts',
            cwd: SERVER_DIR,
            url: `http://127.0.0.1:${API_PORT}/healthz`,
            reuseExistingServer: false,
            env: {
              NODE_ENV: 'test',
              PORT: String(API_PORT),
              PUBLIC_URL: `http://localhost:${WEB_PORT}`,
              PGLITE_DIR: 'memory',
              AUTH_ISSUER: `http://127.0.0.1:${FAKE_IDP_PORT}`,
              AUTH_CLIENT_SECRET: E2E_CLIENT_SECRET,
            },
          },
          {
            command: `pnpm exec vite build && pnpm exec vite preview --port ${WEB_PORT} --strictPort`,
            cwd: WEB_DIR,
            url: `http://localhost:${WEB_PORT}`,
            reuseExistingServer: false,
            timeout: 120_000,
            env: { TRUYEN_API_PORT: String(API_PORT) },
          },
        ],
});
