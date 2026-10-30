import { readFileSync } from 'node:fs';
import type { Page } from '@playwright/test';

/** The Content-Security-Policy nginx sends in production (infra/nginx/truyen.hoandat.com.conf). */
export function productionCsp(): string {
  const conf = readFileSync(new URL('../../../infra/nginx/truyen.hoandat.com.conf', import.meta.url), 'utf8');
  const policy = /set \$truyen_csp "([^"]+)"/.exec(conf)?.[1];
  if (!policy) throw new Error('no $truyen_csp in the nginx config');
  return policy;
}

/**
 * `vite preview` sends no CSP; this adds the production one to every page so a refused script or inline style
 * shows up as a console error, as it would on the site. A deployed site (E2E_BASE_URL) already sends its own.
 */
export async function withProductionCsp(page: Page): Promise<void> {
  if (process.env.E2E_BASE_URL !== undefined) return;
  const policy = productionCsp();
  await page.route('**/*', async (route) => {
    if (route.request().resourceType() !== 'document') return route.continue();
    const response = await route.fetch();
    return route.fulfill({ response, headers: { ...response.headers(), 'content-security-policy': policy } });
  });
}
