/**
 * `pnpm story:voice-sync [--dry-run] [--adopt] [--no-push] [--min 0.8]`: keeps the voices of the voiced stories in step
 * with their text, on the home PC. A retelling (the cloud routine writes only text) changes a story's words and drops
 * its recording references; this finds every story that had a voice and no longer matches, makes the recordings of
 * the changed scenes again with the PC's voice server, names them in story.json, listens to them with the speech check
 * (story-voice-asr.ts), and commits and pushes the result. A check that scores a clip low only raises a warning in the
 * report: the new voice still goes out.
 *
 * - `--dry-run` lists what would be remade and changes nothing.
 * - `--adopt` writes the voice ledger of stories whose recordings were made before the ledger existed, taking them as
 *   made from today's text (run it once, by hand, when that is true).
 * - `--no-push` commits but does not push. `--min` is the speech-check score under which a clip is a warning.
 * - A run needs a clean working tree (it commits only the story folders and the catalog it touched, but it pulls with
 *   rebase first) and the PC online; otherwise it says so and stops without failing, to be run again later.
 * - The report goes to `.work/voice-sync/report.json`. Exit code 2 when it holds warnings, 0 otherwise.
 *
 * Environment: ASR_PYTHON and ASR_CHECK for the speech check (story-voice-asr.ts); without them the voices are made
 * but reported as not checked. The tools of `pnpm story:build` read ARTGEN_DIR, PYTHON and VOICE_URL as usual.
 */
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { parseArgs } from 'node:util';
import { setCatalogStatus } from './story-catalog';
import { REPO_ROOT, type LoadedStory, loadStories, loadStory } from './story-files';
import { asrConfigFromEnv, belowMinimum, checkClips } from './story-voice-asr';
import { type VoiceRemake, adoptRecordings, readLedger, sceneVoiceFile, voiceRemakes, writeLedger } from './story-voice-ledger';

const WORK_DIR = path.join(REPO_ROOT, '.work', 'voice-sync');
const LOCK_FILE = path.join(WORK_DIR, 'lock');
const REPORT_FILE = path.join(WORK_DIR, 'report.json');
const LOCK_STALE_MS = 3 * 60 * 60 * 1000;
const CATALOG = 'catalog/stories.json';

interface Warning {
  slug: string;
  kind: 'asr' | 'asr-not-configured' | 'build' | 'git';
  detail: string;
}

interface Report {
  at: string;
  remade: { slug: string; scenes: number; accuracyMin: number | null }[];
  pending: string[];
  warnings: Warning[];
}

const existsIn = (dir: string, file: string): boolean => existsSync(path.join(dir, file));

function git(args: string[]): { ok: boolean; out: string } {
  const ran = spawnSync('git', args, { cwd: REPO_ROOT, encoding: 'utf8' });
  return { ok: ran.status === 0, out: `${ran.stdout}${ran.stderr}`.trim() };
}

/** One run at a time: the lock is a file, and one older than a few hours is a run that died. */
function takeLock(): boolean {
  mkdirSync(WORK_DIR, { recursive: true });
  if (existsSync(LOCK_FILE) && Date.now() - statSync(LOCK_FILE).mtimeMs > LOCK_STALE_MS) rmSync(LOCK_FILE);
  try {
    writeFileSync(LOCK_FILE, String(process.pid), { flag: 'wx' });
    return true;
  } catch {
    return false;
  }
}

/** `pnpm story:build <slug>` for the voice, music and recording stages; the slug comes from a folder name. */
function buildVoices(slug: string): { ok: boolean; offline: boolean; out: string } {
  const ran = spawnSync('pnpm', ['-s', 'story:build', slug, '--only', 'voices,music,track'], { cwd: REPO_ROOT, encoding: 'utf8', shell: process.platform === 'win32' });
  const out = `${ran.stdout}${ran.stderr}`.trim();
  return { ok: ran.status === 0, offline: out.includes('PC offline'), out };
}

/** Listens to the remade scenes of a story; the lowest score, or null when nothing was checked. */
function listen(remake: VoiceRemake, min: number, warnings: Warning[]): number | null {
  if (remake.sceneIds.length === 0) return null;
  const config = asrConfigFromEnv();
  if (!config) {
    warnings.push({ slug: remake.slug, kind: 'asr-not-configured', detail: 'ASR_PYTHON and ASR_CHECK are not set, so the new voices were not checked' });
    return null;
  }
  const loaded = loadStory(remake.dir);
  if (!loaded.ok) {
    warnings.push({ slug: remake.slug, kind: 'build', detail: loaded.errors.join('; ') });
    return null;
  }
  const clips = loaded.loaded.story.scenes
    .filter((scene) => remake.sceneIds.includes(scene.id))
    .map((scene) => [path.join(remake.dir, sceneVoiceFile(scene)), scene.narration] as const);
  try {
    const results = checkClips(config, clips, WORK_DIR);
    for (const low of belowMinimum(results, min)) {
      warnings.push({ slug: remake.slug, kind: 'asr', detail: `${path.basename(low.file)} scored ${low.accuracy.toFixed(3)}: heard "${low.heard.slice(0, 120)}"` });
    }
    return Math.min(...results.map((result) => result.accuracy));
  } catch (error) {
    warnings.push({ slug: remake.slug, kind: 'asr', detail: error instanceof Error ? error.message : String(error) });
    return null;
  }
}

/** Commits the story folder (and the catalog, when its status changed) and nothing else. */
function commitStory(slug: string, warnings: Warning[]): boolean {
  const paths = [`stories/${slug}`, CATALOG];
  git(['add', '-A', '--', ...paths]);
  if (git(['diff', '--cached', '--quiet', '--', ...paths]).ok) return false;
  const committed = git(['commit', '-q', '-m', `feat(stories): remake the voice of ${slug} after its text changed`, '--', ...paths]);
  if (!committed.ok) warnings.push({ slug, kind: 'git', detail: `commit failed: ${committed.out.slice(-300)}` });
  return committed.ok;
}

function adopt(stories: readonly LoadedStory[]): void {
  for (const { slug, dir, story } of stories) {
    const before = readLedger(dir);
    const after = adoptRecordings(story, before, (file) => existsIn(dir, file));
    if (Object.keys(after).length === Object.keys(before).length) continue;
    writeLedger(dir, after);
    console.log(`${slug}: ledger written for ${Object.keys(after).length - Object.keys(before).length} recording(s)`);
  }
}

function main(): number {
  const { values } = parseArgs({
    options: { 'dry-run': { type: 'boolean', default: false }, adopt: { type: 'boolean', default: false }, 'no-push': { type: 'boolean', default: false }, min: { type: 'string', default: '0.8' } },
  });
  const min = Number.parseFloat(values.min);
  if (!Number.isFinite(min) || min <= 0 || min > 1) throw new Error(`--min takes a score between 0 and 1; got "${values.min}"`);

  if (values.adopt) {
    adopt(loadStories().stories);
    return 0;
  }
  if (!values['dry-run']) {
    if (git(['status', '--porcelain']).out !== '') {
      console.log('voice-sync: the working tree has changes, skipped; run it again when it is clean');
      return 0;
    }
    const pulled = git(['pull', '--rebase', '-q', 'origin', 'main']);
    if (!pulled.ok) throw new Error(`git pull --rebase failed: ${pulled.out.slice(-300)}`);
  }

  const { stories, errors } = loadStories();
  if (errors.length > 0) throw new Error(`the stories do not load:\n  ${errors.join('\n  ')}`);
  const remakes = voiceRemakes(stories, readLedger, existsIn);
  if (remakes.length === 0) {
    console.log('voice-sync: every voiced story matches its text');
    return 0;
  }
  if (values['dry-run']) {
    for (const remake of remakes) console.log(`${remake.slug}: ${remake.sceneIds.length} scene(s) to record again${remake.referencesLost ? ', recording references to restore' : ''}`);
    return 0;
  }

  const report: Report = { at: new Date().toISOString(), remade: [], pending: [], warnings: [] };
  let committed = false;
  for (const [index, remake] of remakes.entries()) {
    console.log(`[${index + 1}/${remakes.length}] ${remake.slug}: ${remake.sceneIds.length} scene(s)`);
    const built = buildVoices(remake.slug);
    if (built.offline) {
      report.pending.push(...remakes.slice(index).map((r) => r.slug));
      console.log('voice-sync: the PC is offline, the rest stays pending');
      break;
    }
    if (!built.ok) {
      report.warnings.push({ slug: remake.slug, kind: 'build', detail: built.out.slice(-300) });
      continue;
    }
    const accuracyMin = listen(remake, min, report.warnings);
    const loaded = loadStory(remake.dir);
    if (loaded.ok && loaded.loaded.story.track !== undefined) setCatalogStatus(remake.slug, 'live');
    report.remade.push({ slug: remake.slug, scenes: remake.sceneIds.length, accuracyMin });
    if (commitStory(remake.slug, report.warnings)) committed = true;
  }

  if (committed && !values['no-push']) {
    const pulled = git(['pull', '--rebase', '-q', 'origin', 'main']);
    const pushed = pulled.ok ? git(['push', '-q', 'origin', 'main']) : pulled;
    if (!pushed.ok) report.warnings.push({ slug: '-', kind: 'git', detail: `push failed: ${pushed.out.slice(-300)}` });
  }

  writeFileSync(REPORT_FILE, `${JSON.stringify(report, null, 2)}\n`);
  console.log(`voice-sync: ${report.remade.length} remade, ${report.pending.length} pending, ${report.warnings.length} warning(s); report in .work/voice-sync/report.json`);
  for (const warning of report.warnings) console.log(`  warning ${warning.slug} [${warning.kind}]: ${warning.detail}`);
  return report.warnings.length > 0 ? 2 : 0;
}

if (!takeLock()) {
  console.log('voice-sync: another run is in progress');
} else {
  try {
    process.exitCode = main();
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  } finally {
    rmSync(LOCK_FILE, { force: true });
  }
}
