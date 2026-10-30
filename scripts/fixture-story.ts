/**
 * Test-only stand-ins for a story's sound: plain tones made with ffmpeg in place of the voices and the music, and the
 * story recording mixed from them by the real build step. Used by the tests of the story recording and to try the
 * reader (web or iPhone app) with sound before the home PC has made any; never written under stories/.
 *
 *   pnpm fixture:story <out-dir> [slug] [seconds per voice]
 *
 * writes <out-dir>/stories/<slug>/ (a copy of the repository story with tone voices, music and recording) and
 * <out-dir>/stories/index.json; point the web build at it with TRUYEN_STORIES_DIR=<out-dir>/stories.
 */
import { spawnSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { type Story, storyListEntry } from '@truyen/story';
import { type BuildStep, TRACK_FILE } from './story-build-plan';
import { BuildError, makeStoryTrack } from './story-build-run';
import { STORIES_DIR, loadStory, writeStory } from './story-files';

/** Writes a tone of `seconds` at `frequency` Hz as AAC; `level` is its amplitude (0–1). */
export function makeTone(file: string, seconds: number, frequency: number, level = 0.6): void {
  mkdirSync(path.dirname(file), { recursive: true });
  const ran = spawnSync(
    'ffmpeg',
    ['-y', '-v', 'error', '-f', 'lavfi', '-i', `aevalsrc=${level}*sin(2*PI*${frequency}*t):s=44100:d=${seconds}`, '-c:a', 'aac', '-b:a', '64k', '-ac', '1', file],
    { encoding: 'utf8' },
  );
  if (ran.error) throw new BuildError(`ffmpeg could not start: ${ran.error.message}`);
  if (ran.status !== 0) throw new BuildError(`ffmpeg could not make ${file}: ${ran.stderr.trim()}`);
}

/** A planned story recording step over files anywhere on disk (absolute paths). */
export function trackStep(voices: string[], music: string, output: string): BuildStep {
  return { id: 'track', stage: 'track', commands: [], inputs: [...voices, music], output, pc: null, track: { voices, music } };
}

/**
 * Copies the repository story `slug` into `outStories/<slug>/` with a tone for each scene voice (`voiceSeconds` long),
 * a looped tone for the music, and the story recording mixed from them. Returns the story as written.
 */
export function makeFixtureStory(outStories: string, slug: string, voiceSeconds: number): Story {
  const loaded = loadStory(path.join(STORIES_DIR, slug));
  if (!loaded.ok) throw new BuildError(`stories/${slug} is not valid:\n  ${loaded.errors.join('\n  ')}`);
  const dir = path.join(outStories, slug);
  const original = loaded.loaded.story;
  const scenes = original.scenes.map((scene, index) => {
    const file = `media/scenes/${scene.id}.m4a`;
    // Each scene a different pitch, so a wrong scene is heard as well as seen.
    makeTone(path.join(dir, file), voiceSeconds, 330 + 55 * index);
    return { ...scene, voice: { file } };
  });
  makeTone(path.join(dir, 'media/music.m4a'), 4, 196, 0.4);
  const voiced: Story = { ...original, scenes, music: { ...original.music, file: 'media/music.m4a' } };
  const step = trackStep(
    scenes.map((scene) => path.join(dir, scene.voice.file)),
    path.join(dir, 'media/music.m4a'),
    path.join(dir, TRACK_FILE),
  );
  const story: Story = { ...voiced, track: makeStoryTrack(step, scenes, TRACK_FILE) };
  writeStory(dir, story);
  return story;
}

function main(): void {
  const [out, slug = 'son-tinh-thuy-tinh', seconds = '6'] = process.argv.slice(2);
  if (!out) throw new BuildError('usage: pnpm fixture:story <out-dir> [slug] [seconds per voice]');
  const voiceSeconds = Number(seconds);
  if (!Number.isFinite(voiceSeconds) || voiceSeconds <= 0 || voiceSeconds > 120) throw new BuildError(`seconds per voice: a number from 0 to 120, got "${seconds}"`);
  const outStories = path.resolve(out, 'stories');
  if (path.resolve(outStories).startsWith(STORIES_DIR)) throw new BuildError('the fixture never goes under stories/');
  const story = makeFixtureStory(outStories, slug, voiceSeconds);
  writeFileSync(path.join(outStories, 'index.json'), `${JSON.stringify([storyListEntry(story)])}\n`);
  console.log(`${outStories}/${slug}: test tones and a ${story.track?.duration ?? 0} s recording; TRUYEN_STORIES_DIR=${outStories}`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    main();
  } catch (error) {
    console.error(error instanceof BuildError ? error.message : error);
    process.exitCode = 1;
  }
}
