/**
 * The iPhone app build (`vite build --mode native`, wrapped by apps/mobile): the same app packed inside the iPhone app,
 * into dist-native/. Its page runs at capacitor://localhost and reads the stories and their media from the site
 * (https://truyen.hoandat.com/stories/…) through the app's own HTTP (no CORS needed), or from the phone once a story is
 * downloaded. Differences from the web build:
 *
 * - no stories packed in (they are read from the site), unless TRUYEN_STORY_ORIGIN=bundled packs those of
 *   TRUYEN_STORIES_DIR in, for a test build that plays test stories with no network (`pnpm fixture:story`);
 * - no prerendered pages, robots.txt or noindex marker (nothing to index inside an app);
 * - a Content-Security-Policy meta tag: the site's policy (infra/nginx) without Cloudflare Web Analytics, which only
 *   the Cloudflare edge adds to the web pages and never reaches the app, plus the story origin for pictures and sound.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { primaryOrigin } from '@achoo254/brand/hosts';
import type { Plugin } from 'vite';
import { brand } from './src/brand.ts';

export const NATIVE_MODE = 'native';
/** Output folder of the app build (Capacitor's `webDir`); the web build keeps `dist/`. */
export const NATIVE_OUT_DIR = 'dist-native';
/** Another story origin for an app build: a URL (https, or http to this Mac for the Simulator), or `bundled`. */
export const STORY_ORIGIN_ENV = 'TRUYEN_STORY_ORIGIN';
/** Packs the stories into the app instead of reading them from a server (test builds only). */
export const BUNDLED = 'bundled';

const LOOPBACK = new Set(['localhost', '127.0.0.1', '[::1]']);

/**
 * Cloudflare Web Analytics, which the Cloudflare edge adds to the web pages it serves: the web policy allows its beacon
 * script and the address it posts to; the app has no edge in front of its pages and no third-party tracking.
 */
export const CLOUDFLARE_ANALYTICS = ['https://static.cloudflareinsights.com', 'https://cloudflareinsights.com'] as const;
/** Directives a meta tag cannot carry (browsers ignore them there and warn). */
const HEADER_ONLY = new Set(['frame-ancestors', 'report-uri', 'sandbox']);

/**
 * The story origin an app build bakes in: '' for `bundled` (relative /stories/ addresses, packed in the app), else
 * TRUYEN_STORY_ORIGIN when set, else the brand's web origin (https://truyen.hoandat.com). A bare origin over https;
 * plain http only to this machine, never to a remote host.
 */
export function nativeStoryOrigin(env: Readonly<Record<string, string | undefined>>): string {
  const raw = env[STORY_ORIGIN_ENV]?.trim() || primaryOrigin(brand);
  if (raw === BUNDLED) return '';
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new Error(`${STORY_ORIGIN_ENV} is not a URL: ${raw}`);
  }
  if (url.origin !== raw.replace(/\/$/, '')) throw new Error(`${STORY_ORIGIN_ENV} must be an origin only (no path, query or credentials): ${raw}`);
  const secure = url.protocol === 'https:' || (url.protocol === 'http:' && LOOPBACK.has(url.hostname));
  if (!secure) throw new Error(`${STORY_ORIGIN_ENV} must use https (http only to localhost): ${raw}`);
  return url.origin;
}

/** The Content-Security-Policy nginx sends with the site (infra/nginx/truyen.hoandat.com.conf). */
export function siteContentSecurityPolicy(): string {
  const conf = readFileSync(path.join(import.meta.dirname, '../../infra/nginx/truyen.hoandat.com.conf'), 'utf8');
  const policy = /set \$truyen_csp "([^"]+)"/.exec(conf)?.[1];
  if (!policy) throw new Error('no $truyen_csp in infra/nginx/truyen.hoandat.com.conf');
  return policy;
}

/**
 * The site's policy for the app: Cloudflare Web Analytics and the header-only directives dropped, the story origin
 * added where pictures, motion, sound and story files come from.
 */
export function nativeContentSecurityPolicy(sitePolicy: string, storyOrigin: string): string {
  const extra: Record<string, string[]> = storyOrigin ? { 'connect-src': [storyOrigin], 'img-src': [storyOrigin], 'media-src': [storyOrigin] } : {};
  const tracking = new Set<string>(CLOUDFLARE_ANALYTICS);
  return sitePolicy
    .split(';')
    .map((directive) => directive.trim().split(/\s+/))
    .filter(([name]) => name !== undefined && name !== '' && !HEADER_ONLY.has(name))
    .map(([name = '', ...values]) => [name, ...values.filter((value) => !tracking.has(value)), ...(extra[name] ?? [])].join(' '))
    .join('; ');
}

/** Puts the policy into the page head, before any script. */
export function withPolicyMeta(html: string, policy: string): string {
  const meta = `<meta http-equiv="Content-Security-Policy" content="${policy.replace(/"/g, '&quot;')}" />`;
  return html.replace(/(<meta charset="UTF-8" \/>)/, `$1\n    ${meta}`);
}

export function nativePolicy(storyOrigin: string): Plugin {
  const policy = nativeContentSecurityPolicy(siteContentSecurityPolicy(), storyOrigin);
  return { name: 'truyen-native-policy', apply: 'build', transformIndexHtml: (html) => withPolicyMeta(html, policy) };
}
