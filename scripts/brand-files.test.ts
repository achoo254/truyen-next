import { existsSync, readFileSync } from 'node:fs';
import { iconSourceHashes } from '@achoo254/brand/build';
import { describe, expect, it } from 'vitest';
import { BRAND_GENERATED_DIR, BRAND_ROOT, OG_IMAGE, loadTruyenBrand, renderIndexHtml } from '../apps/web/vite-brand';

describe('generated brand files', () => {
  it('were drawn from the current brand icons (run pnpm brand:gen after changing them)', () => {
    const recorded: unknown = JSON.parse(readFileSync(new URL('icons/icons-source.json', BRAND_GENERATED_DIR), 'utf8'));
    expect(recorded).toEqual(iconSourceHashes(loadTruyenBrand(), BRAND_ROOT));
  });

  it('point link previews at the og-image that pnpm brand:gen draws', () => {
    expect(existsSync(new URL(`apps/web/public/${OG_IMAGE.path}`, BRAND_ROOT))).toBe(true);
    const html = renderIndexHtml('<head><title>%APP_NAME%</title><link rel="icon" type="image/svg+xml" href="/favicon.svg" /></head>', loadTruyenBrand());
    expect(html).toContain('<meta property="og:image" content="https://truyen.hoandat.com/og-image.png" />');
    expect(html).toContain('<meta name="twitter:card" content="summary_large_image" />');
  });
});
