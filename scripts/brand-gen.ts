/**
 * `pnpm brand:gen`: what the platforms show of the brand, with the Chromium of @playwright/test:
 *
 * - brand/generated/: the web manifest, PNG icons and favicon.ico, drawn from brand/icon.svg,
 *   brand/icon-maskable.svg and brand.config.json (writeBrandFiles);
 * - apps/web/public/og-image.png: the 1200 × 630 link preview in the app's look: the home print
 *   (apps/web/src/art/dong-ho-print.svg) beside the name and the footer line, on the paper texture, in the colours
 *   of apps/web/src/ui/tokens.css and the app's own fonts.
 *
 * Run after changing the icons, the print, the tokens or the brand, then commit the files. When the AI-drawn icon is
 * made on the home PC, it replaces brand/icon*.svg and this is run again.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import { chromiumRenderer, writeBrandFiles } from '@achoo254/brand/build';
import { primaryOrigin } from '@achoo254/brand/hosts';
import { chromium } from '@playwright/test';
import { vi as messages } from '../apps/web/src/i18n/messages';
import { BRAND_GENERATED_DIR, BRAND_ROOT, MANIFEST_OPTIONS, OG_IMAGE, type TruyenBrand, loadTruyenBrand } from '../apps/web/vite-brand';
import { type TokenMap, parseTokens } from './token-contrast';

const PRINT = new URL('apps/web/src/art/dong-ho-print.svg', BRAND_ROOT);
const TOKENS = new URL('apps/web/src/ui/tokens.css', BRAND_ROOT);
const PUBLIC_DIR = new URL('apps/web/public/', BRAND_ROOT);

const webRequire = createRequire(new URL('apps/web/package.json', BRAND_ROOT));

/** A @fontsource weight stylesheet with its WOFF2 files inlined (WOFF fallbacks dropped), so the page renders offline. */
function inlinedFontCss(stylesheet: string): string {
  const file = webRequire.resolve(stylesheet);
  return readFileSync(file, 'utf8').replace(/url\(\.\/files\/([^)]+\.woff2)\) format\('woff2'\)(, url\([^)]+\) format\('woff'\))?/g, (_match, name: string) => {
    const bytes = readFileSync(new URL(`files/${name}`, pathToFileURL(file)));
    return `url(data:font/woff2;base64,${bytes.toString('base64')}) format('woff2')`;
  });
}

function token(tokens: TokenMap, name: string): string {
  const value = tokens.get(name);
  if (value === undefined) throw new Error(`brand:gen: tokens.css does not define ${name}`);
  return value;
}

function ogHtml(brand: TruyenBrand, tokens: TokenMap, printDataUrl: string): string {
  const t = (name: string): string => token(tokens, name);
  const host = new URL(primaryOrigin(brand)).host;
  return `<!doctype html><html lang="vi"><head><style>
${inlinedFontCss('@fontsource/alegreya/800.css')}
${inlinedFontCss('@fontsource/alegreya-sans/500.css')}
${inlinedFontCss('@fontsource/alegreya-sans/700.css')}
body { margin: 0; }
.og { position: relative; width: ${OG_IMAGE.width}px; height: ${OG_IMAGE.height}px; overflow: hidden; box-sizing: border-box;
  background-color: ${t('--c-bg')}; background-image: ${t('--paper-texture')}; color: ${t('--c-text')}; font-family: 'Alegreya Sans', sans-serif; }
.frame { position: absolute; inset: 18px; border: 8px solid ${t('--c-text')}; }
.frame::after { content: ''; position: absolute; inset: 8px; border: 2px solid ${t('--c-text')}; }
.fret { position: absolute; left: 36px; right: 36px; bottom: 36px; height: 14px; background: ${t('--band-fret')} repeat-x; }
.text { position: absolute; left: 96px; top: 0; bottom: 40px; width: 610px; display: flex; flex-direction: column; justify-content: center; gap: 22px; }
.seal { align-self: flex-start; padding: 4px 16px; border: 3px solid ${t('--c-text')}; border-radius: 4px; background: ${t('--c-turmeric')};
  font-family: 'Alegreya', serif; font-weight: 800; font-size: 28px; transform: rotate(-2deg); }
.name { font-family: 'Alegreya', serif; font-weight: 800; font-size: 168px; line-height: .9; letter-spacing: -.01em; }
.curl { width: 120px; height: 74px; background: ${t('--c-vermilion')}; -webkit-mask: ${t('--orn-cloud')} no-repeat left center / contain; }
.line { font-size: 38px; line-height: 1.3; font-weight: 500; }
.host { font-size: 28px; font-weight: 700; color: ${t('--c-primary')}; }
.print { position: absolute; right: 92px; top: 66px; width: 384px; height: 480px; transform: rotate(2deg);
  box-shadow: ${t('--shadow-print')}; }
</style></head><body>
<div class="og">
<div class="frame"></div>
<div class="text">
<div class="seal">${messages['home.title']}</div>
<div class="name">${brand.appName}</div>
<div class="curl"></div>
<div class="line">${messages['layout.note']}</div>
<div class="host">${host}</div>
</div>
<img class="print" src="${printDataUrl}" alt="">
<div class="fret"></div>
</div></body></html>`;
}

async function main(): Promise<void> {
  const brand = loadTruyenBrand();
  const tokens = parseTokens(readFileSync(TOKENS, 'utf8'));
  const printDataUrl = `data:image/svg+xml;base64,${readFileSync(PRINT).toString('base64')}`;
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({ deviceScaleFactor: 1, viewport: { width: OG_IMAGE.width, height: OG_IMAGE.height } });
    await page.setContent(ogHtml(brand, tokens, printDataUrl));
    await page.locator('img').evaluateAll((images: HTMLImageElement[]) => Promise.all(images.map((img) => img.decode())));
    await page.evaluate(() => document.fonts.ready);
    writeFileSync(new URL(OG_IMAGE.path, PUBLIC_DIR), await page.screenshot({ clip: { x: 0, y: 0, width: OG_IMAGE.width, height: OG_IMAGE.height } }));
  } finally {
    await browser.close();
  }
  const written = await writeBrandFiles({
    brand,
    root: BRAND_ROOT,
    generatedDir: BRAND_GENERATED_DIR,
    manifests: MANIFEST_OPTIONS,
    indent: 2,
    renderer: chromiumRenderer(chromium),
  });
  console.log(`Wrote ${OG_IMAGE.path} and ${written.length} files to brand/generated/: ${written.join(', ')}`);
}

main().catch((error: unknown) => {
  console.error('brand:gen failed:', error);
  process.exitCode = 1;
});
