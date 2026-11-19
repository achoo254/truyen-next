/**
 * `pnpm story:build <slug> [--dry-run] [--only characters,images,…] [--force] [--name-existing]`: makes a story's media on the home PC
 * with the inet-artgen tools, step by step (story-build-plan.ts), writing each finished file's path into
 * story.json so the app shows it.
 *
 * - `--dry-run` prints every planned call and runs nothing.
 * - A real run needs the PC online: `artgen.py --health` (and `voice.py --health` before voices) failing stops the
 *   run with "PC offline, pending".
 * - Steps whose file already exists are skipped, so a run stopped halfway picks up where it left off; `--force`
 *   makes them again. The story recording (`track`) is made again by itself when a voice or the music is newer.
 * - `--name-existing` only names, in story.json, the files of every stage that are already there (a retelling writes
 *   story.json without any `file`) and makes nothing.
 * - `track` needs no PC, only ffmpeg and ffprobe: `--only track` after the voices and the music are made.
 *
 * Environment: ARTGEN_DIR (default ~/.claude/skills/inet-artgen), PYTHON (default python3, python on Windows),
 * ARTGEN_URL / VOICE_URL are read by the tools themselves.
 */
import { existsSync, statSync } from 'node:fs';
import { homedir } from 'node:os';
import path from 'node:path';
import { parseArgs } from 'node:util';
import type { Story } from '@truyen/story';
import { REPO_ROOT, STORIES_DIR, loadStory, writeStory } from './story-files';
import { type BuildStep, STAGES, type Stage, TRACK_FILE, type Tools, applyRecord, planStoryBuild, shellQuote, toolPath } from './story-build-plan';
import { BuildError, makeStoryTrack, requireHealthy, runStep } from './story-build-run';
import { readLedger, sceneFingerprint, staleVoiceScenes, writeLedger } from './story-voice-ledger';

function parseStages(value: string | undefined): Stage[] {
  if (value === undefined) return [...STAGES];
  const picked = value.split(',').map((s) => s.trim()).filter(Boolean);
  const unknown = picked.filter((s) => !(STAGES as readonly string[]).includes(s));
  if (unknown.length > 0 || picked.length === 0) throw new BuildError(`--only takes ${STAGES.join(', ')}; got "${value}"`);
  return picked as Stage[];
}

function defaultTools(): Tools {
  return {
    python: process.env.PYTHON ?? (process.platform === 'win32' ? 'python' : 'python3'),
    artgenDir: process.env.ARTGEN_DIR ?? path.join(homedir(), '.claude', 'skills', 'inet-artgen'),
  };
}

const inRepo = (file: string): string => path.join(REPO_ROOT, file);

/**
 * Whether a step still has to run: its file is missing; a voice made from other words or another voice than today's
 * (`staleVoices`, by scene id, from the voice ledger); or the story recording, which is also made when story.json
 * has none or when a voice or the music is newer.
 */
function needsRun(step: BuildStep, force: boolean, story: Story, staleVoices: ReadonlySet<string>): boolean {
  if (force || !existsSync(inRepo(step.output))) return true;
  if (step.record?.kind === 'voice' && staleVoices.has(step.record.id)) return true;
  if (!step.track) return false;
  if (story.track === undefined) return true;
  const made = statSync(inRepo(step.output)).mtimeMs;
  return step.inputs.some((input) => existsSync(inRepo(input)) && statSync(inRepo(input)).mtimeMs > made);
}

function main(): void {
  const { values, positionals } = parseArgs({
    allowPositionals: true,
    options: { 'dry-run': { type: 'boolean', default: false }, only: { type: 'string' }, force: { type: 'boolean', default: false }, 'name-existing': { type: 'boolean', default: false } },
  });
  const [slug, ...extra] = positionals;
  if (!slug || extra.length > 0) throw new BuildError('usage: pnpm story:build <slug> [--dry-run] [--only characters,images,videos,voices,music,track,social] [--force] [--name-existing]');
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) throw new BuildError(`"${slug}" is not a story slug (the folder name under stories/)`);
  const dir = path.join(STORIES_DIR, slug);
  const loaded = loadStory(dir);
  if (!loaded.ok) throw new BuildError(`stories/${slug} is not valid:\n  ${loaded.errors.join('\n  ')}`);
  let story: Story = loaded.loaded.story;
  const tools = defaultTools();
  const steps = planStoryBuild(story, tools, values['name-existing'] ? [...STAGES] : parseStages(values.only));
  const ledger = readLedger(dir);
  const staleVoices = new Set(staleVoiceScenes(story, ledger, (file) => existsSync(path.join(dir, file))).map((scene) => scene.id));
  const needed = (step: BuildStep): boolean => needsRun(step, values.force, story, staleVoices);
  // The story recording also has to be made again when a voice or the music it mixes is made in this very run: its
  // files are not newer yet when the plan is drawn up, so needsRun cannot see it.
  const rebuilt = new Set(steps.filter((step) => !step.track && needed(step)).map((step) => step.output));
  const pending = (step: BuildStep): boolean => needed(step) || (step.track !== undefined && step.inputs.some((input) => rebuilt.has(input)));

  if (values['dry-run']) {
    const pcCheck = steps.some((step) => step.pc !== null) ? `the PC is checked first: ${shellQuote([tools.python, toolPath(tools, 'artgen.py'), '--health'])}` : 'no PC needed';
    console.log(`# ${steps.length} steps; ${pcCheck}`);
    for (const step of steps) {
      const done = !pending(step);
      console.log(`\n# ${step.id}${done ? ' (done, skipped)' : ''} -> ${step.output}`);
      if (step.track) console.log('# laid out here from the estimated reading times; a real run measures each voice with ffprobe first');
      for (const argv of step.commands) console.log(shellQuote(argv));
    }
    return;
  }

  const todo = steps.filter(pending);
  // A file that is there and up to date but that story.json no longer names (a retelling writes story.json without
  // any `file`) is named again, so the story does not lose its pictures and voices until a new build finds them.
  const restored = steps.filter((step) => !todo.includes(step) && step.record).reduce((current, step) => (step.record ? applyRecord(current, step.record) : current), story);
  if (JSON.stringify(restored) !== JSON.stringify(story)) {
    story = restored;
    writeStory(dir, story);
    console.log(`${slug}: named the files that were already made`);
  }
  if (values['name-existing']) return;
  if (todo.length === 0) {
    console.log(`${slug}: nothing to make, every planned file exists`);
    return;
  }
  if (todo.some((step) => step.pc !== null)) requireHealthy(tools, 'artgen.py');
  if (todo.some((step) => step.pc === 'voice')) requireHealthy(tools, 'voice.py');

  for (const [index, step] of todo.entries()) {
    const missing = step.inputs.filter((input) => !existsSync(path.join(REPO_ROOT, input)));
    if (missing.length > 0) throw new BuildError(`${step.id}: make ${missing.join(', ')} first (run the earlier stages)`);
    console.log(`[${index + 1}/${todo.length}] ${step.id}`);
    if (step.track) {
      story = { ...story, track: makeStoryTrack(step, story.scenes, TRACK_FILE) };
      writeStory(dir, story);
      continue;
    }
    runStep(step);
    const { record } = step;
    if (record) {
      story = applyRecord(story, record);
      writeStory(dir, story);
      if (record.kind === 'voice') {
        const scene = story.scenes.find((s) => s.id === record.id);
        if (scene) {
          ledger[scene.id] = sceneFingerprint(story, scene);
          writeLedger(dir, ledger);
        }
      }
    }
  }
  console.log(`${slug}: ${todo.length} step(s) done; review the pictures, motion and voice before publishing.`);
}

try {
  main();
} catch (error) {
  console.error(error instanceof BuildError ? error.message : error);
  process.exitCode = 1;
}
