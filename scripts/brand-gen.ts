/**
 * `pnpm brand:gen`: the web manifest, PNG icons and favicon.ico in brand/generated/, drawn from brand/icon.svg,
 * brand/icon-maskable.svg and brand.config.json with the Chromium of @playwright/test.
 *
 * Run after changing the icons or the brand, then commit the files. When the AI-drawn icon is made on the home PC,
 * it replaces brand/icon*.svg and this is run again.
 */
import { chromiumRenderer, writeBrandFiles } from '@achoo254/brand/build';
import { chromium } from '@playwright/test';
import { BRAND_GENERATED_DIR, BRAND_ROOT, MANIFEST_OPTIONS, loadTruyenBrand } from '../apps/web/vite-brand';

async function main(): Promise<void> {
  const written = await writeBrandFiles({
    brand: loadTruyenBrand(),
    root: BRAND_ROOT,
    generatedDir: BRAND_GENERATED_DIR,
    manifests: MANIFEST_OPTIONS,
    indent: 2,
    renderer: chromiumRenderer(chromium),
  });
  console.log(`Wrote ${written.length} files to brand/generated/: ${written.join(', ')}`);
}

main().catch((error: unknown) => {
  console.error('brand:gen failed:', error);
  process.exitCode = 1;
});
