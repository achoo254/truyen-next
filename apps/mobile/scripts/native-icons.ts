/**
 * Draws the iPhone app's icon and launch screen from the brand icon (brand/icon.svg) and the brand background colour,
 * with the Chromium of @playwright/test, then writes them without an alpha channel (ffmpeg), as the App Store wants:
 *
 * - AppIcon.appiconset/AppIcon-512@2x.png: 1024 × 1024, the icon full-bleed (its rounded corners squared: iOS rounds
 *   them itself);
 * - Splash.imageset/splash-2732x2732*.png: the icon in the middle of the brand background, the size the Capacitor
 *   template gives the launch screen picture.
 *
 * The icon is the interim vector mark until the AI-drawn one is made; run again after changing it, then commit the PNGs:
 *
 *   pnpm --filter @truyen/mobile icons
 */
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';

const MOBILE_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const REPO_ROOT = path.resolve(MOBILE_DIR, '../..');
const ASSETS = path.join(MOBILE_DIR, 'ios/App/App/Assets.xcassets');
const ICON_SIZE = 1024;
const SPLASH_SIZE = 2732;
/** The icon's share of the launch screen's side. */
const SPLASH_ICON_SHARE = 0.22;

interface Brand {
  icon: string;
  colors: { background: string };
}

function readBrand(): Brand {
  const raw = JSON.parse(readFileSync(path.join(REPO_ROOT, 'brand.config.json'), 'utf8')) as Partial<Brand>;
  if (typeof raw.icon !== 'string' || !/^#[0-9a-f]{6}$/i.test(raw.colors?.background ?? '')) throw new Error('brand.config.json: icon and colors.background (#rrggbb) are required');
  return { icon: raw.icon, colors: { background: raw.colors?.background ?? '' } };
}

/** The icon with the corner radius of its tile taken off: iOS masks the corners itself. */
export function squareIcon(svg: string): string {
  const squared = svg.replace(/(<rect\b[^>]*?)\s+rx="[^"]*"/, '$1');
  if (squared === svg) throw new Error('brand icon: no rounded tile <rect rx> found to square');
  return squared;
}

/** Rewrites a PNG as 8-bit RGB (no alpha), optionally scaled. */
function opaquePng(input: string, output: string): void {
  const ran = spawnSync('ffmpeg', ['-y', '-v', 'error', '-i', input, '-pix_fmt', 'rgb24', output], { encoding: 'utf8' });
  if (ran.error) throw new Error(`ffmpeg could not start: ${ran.error.message}`);
  if (ran.status !== 0) throw new Error(`ffmpeg failed on ${input}: ${ran.stderr.trim()}`);
}

async function main(): Promise<void> {
  const brand = readBrand();
  const svg = squareIcon(readFileSync(path.join(REPO_ROOT, brand.icon), 'utf8'));
  const iconData = `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`;
  const work = mkdtempSync(path.join(tmpdir(), 'truyen-icons-'));
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({ viewport: { width: ICON_SIZE, height: ICON_SIZE } });
    await page.setContent(`<html><body style="margin:0"><img src="${iconData}" width="${ICON_SIZE}" height="${ICON_SIZE}" style="display:block"></body></html>`);
    await page.screenshot({ path: path.join(work, 'icon.png') });
    opaquePng(path.join(work, 'icon.png'), path.join(ASSETS, 'AppIcon.appiconset/AppIcon-512@2x.png'));

    const side = Math.round(SPLASH_SIZE * SPLASH_ICON_SHARE);
    const rounded = `data:image/svg+xml;base64,${readFileSync(path.join(REPO_ROOT, brand.icon)).toString('base64')}`;
    await page.setViewportSize({ width: SPLASH_SIZE, height: SPLASH_SIZE });
    await page.setContent(
      `<html><body style="margin:0;width:${SPLASH_SIZE}px;height:${SPLASH_SIZE}px;display:grid;place-items:center;background:${brand.colors.background}"><img src="${rounded}" width="${side}" height="${side}"></body></html>`,
    );
    await page.screenshot({ path: path.join(work, 'splash.png') });
    for (const name of ['splash-2732x2732.png', 'splash-2732x2732-1.png', 'splash-2732x2732-2.png']) {
      opaquePng(path.join(work, 'splash.png'), path.join(ASSETS, 'Splash.imageset', name));
    }
  } finally {
    await browser.close();
    rmSync(work, { recursive: true, force: true });
  }
  console.log('icons: wrote AppIcon-512@2x.png and the launch screen; commit them');
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
