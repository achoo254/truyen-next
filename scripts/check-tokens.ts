/**
 * `pnpm check:tokens`: design-token guard of the web app.
 *
 * 1. No colour literal in apps/web/src (ts, tsx, css) or apps/web/index.html outside src/ui/tokens.css.
 * 2. In each look (light, and lamplit for lights off), every text/background pair the UI uses meets WCAG 2 AA (text 4.5:1): every text colour on every paper surface
 *    (page, cards, header, the children's turmeric panel, the book's pages and the plain scene backdrop), the
 *    labels of the vermilion and ink buttons, ink on the turmeric seals, the footer's text on its ink band; and
 *    outlines meet 3:1 (non-text) on the surfaces they sit on.
 *
 * Exits 1 on any failure, printing file:line for literals and the ratio of each failing pair.
 */
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { type LiteralViolation, type TokenMap, contrastRatio, findColourLiterals, parseThemes } from './token-contrast';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const WEB = path.join(ROOT, 'apps/web');
const TOKENS_FILE = path.join(WEB, 'src/ui/tokens.css');
const SCANNED = new Set(['.ts', '.tsx', '.css']);
const AA_TEXT = 4.5;
const AA_NON_TEXT = 3;

const SCREEN_TEXT = ['--c-text', '--c-text-muted', '--c-primary', '--c-leaf', '--c-error'];
const SCREEN_BACKGROUNDS = [
  '--c-bg',
  '--c-surface',
  '--c-surface-raised',
  '--c-topbar',
  '--c-kids-field',
  '--c-adults-field',
  '--c-page',
  '--c-subtitle-bg',
  '--c-stage-top',
  '--c-stage-bottom',
];
const OUTLINES = ['--c-border-strong', '--c-focus', '--c-line', '--c-focus-ring-on-accent'];
/** Solid fills and the text drawn on them: buttons (vermilion, ink) and seals (turmeric, ink). */
const ON_FILLS: ReadonlyArray<readonly [string, string[]]> = [
  ['--c-on-primary', ['--c-primary-solid', '--c-primary-solid-hover']],
  ['--c-on-ink', ['--c-ink-solid', '--c-ink-solid-hover']],
  ['--c-on-turmeric', ['--c-turmeric']],
  // the title cartouche of every cover
  ['--c-print-ink', ['--c-print-paper']],
];
const FOOT_TEXT = ['--c-foot-text', '--c-foot-muted', '--c-foot-link'];

async function sourceFiles(dir: string): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true });
  const nested = await Promise.all(
    entries.map(async (entry) => {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) return sourceFiles(full);
      return SCANNED.has(path.extname(entry.name)) ? [full] : [];
    }),
  );
  return nested.flat();
}

async function literalViolations(): Promise<LiteralViolation[]> {
  const files = [...(await sourceFiles(path.join(WEB, 'src'))).filter((f) => f !== TOKENS_FILE), path.join(WEB, 'index.html')];
  const results = await Promise.all(files.map(async (file) => findColourLiterals(await readFile(file, 'utf8'), path.relative(ROOT, file))));
  return results.flat();
}

function value(tokens: TokenMap, name: string): string {
  const found = tokens.get(name);
  if (found === undefined) throw new Error(`tokens.css does not define ${name}`);
  return found;
}

/** Every pair to check: [label, foreground colour, background colour, minimum ratio]. */
function pairs(tokens: TokenMap): Array<readonly [string, string, string, number]> {
  const v = (name: string): string => value(tokens, name);
  const list: Array<readonly [string, string, string, number]> = [];
  for (const fg of SCREEN_TEXT) for (const bg of SCREEN_BACKGROUNDS) list.push([`${fg} on ${bg}`, v(fg), v(bg), AA_TEXT]);
  for (const [fg, fills] of ON_FILLS) for (const bg of fills) list.push([`${fg} on ${bg}`, v(fg), v(bg), AA_TEXT]);
  for (const fg of FOOT_TEXT) list.push([`${fg} on --c-foot`, v(fg), v('--c-foot'), AA_TEXT]);
  for (const fg of OUTLINES) for (const bg of SCREEN_BACKGROUNDS) list.push([`${fg} (outline) on ${bg}`, v(fg), v(bg), AA_NON_TEXT]);
  list.push(['--c-focus-on-dark (outline) on --c-foot', v('--c-focus-on-dark'), v('--c-foot'), AA_NON_TEXT]);
  list.push(['--c-sleep-text on --c-sleep', v('--c-sleep-text'), v('--c-sleep'), AA_TEXT]);
  return list;
}

async function main(): Promise<number> {
  let failed = false;
  const violations = await literalViolations();
  if (violations.length > 0) {
    failed = true;
    console.error(`✗ ${violations.length} colour literal(s) outside apps/web/src/ui/tokens.css:`);
    for (const v of violations) console.error(`  ${v.file}:${v.line}  ${v.match}`);
  } else {
    console.log('✓ No colour literals outside tokens.css');
  }

  const themes = parseThemes(await readFile(TOKENS_FILE, 'utf8'));
  const checked = [...themes].flatMap(([theme, tokens]) => pairs(tokens).map(([label, fg, bg, minimum]) => [`${theme}: ${label}`, fg, bg, minimum] as const));
  const failures = checked
    .map(([label, fg, bg, minimum]) => ({ label, minimum, ratio: contrastRatio(fg, bg) }))
    .filter((pair) => pair.ratio < pair.minimum)
    .map((pair) => `  ${pair.ratio.toFixed(2)}:1 < ${pair.minimum}:1  ${pair.label}`);
  if (failures.length > 0) {
    failed = true;
    console.error(`✗ ${failures.length} of ${checked.length} contrast pair(s) below WCAG AA:`);
    for (const line of failures) console.error(line);
  } else {
    console.log(`✓ ${checked.length} contrast pairs meet WCAG AA in ${themes.size} looks (${[...themes.keys()].join(', ')}; text ${AA_TEXT}:1, outlines ${AA_NON_TEXT}:1)`);
  }
  return failed ? 1 : 0;
}

main().then(
  (code) => {
    process.exitCode = code;
  },
  (error: unknown) => {
    console.error('check:tokens crashed:', error);
    process.exitCode = 1;
  },
);
