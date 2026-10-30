/**
 * Reads every `stories/<slug>/story.json` from disk and checks it, including that each media file the story refers
 * to exists. Shared by `pnpm check:stories`, `pnpm story:build` and the web app's dev server and build.
 */
import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { type Story, storyMediaFiles, validateStory } from '@truyen/story';

export const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const STORIES_DIR = path.join(REPO_ROOT, 'stories');
export const STORY_FILE = 'story.json';

export interface LoadedStory {
  slug: string;
  /** Absolute path of the story folder. */
  dir: string;
  story: Story;
}

export type LoadResult = { ok: true; loaded: LoadedStory } | { ok: false; errors: string[] };

/** One story folder: parse, validate, and check its media files exist. */
export function loadStory(dir: string): LoadResult {
  const slug = path.basename(dir);
  const file = path.join(dir, STORY_FILE);
  let data: unknown;
  try {
    data = JSON.parse(readFileSync(file, 'utf8'));
  } catch (error) {
    return { ok: false, errors: [`${slug}/${STORY_FILE}: ${error instanceof Error ? error.message : String(error)}`] };
  }
  const result = validateStory(data, slug);
  if (!result.ok) return { ok: false, errors: result.errors.map((e) => `${slug}/${STORY_FILE} ${e}`) };
  const missing = storyMediaFiles(result.story).filter((media) => !existsSync(path.join(dir, media)));
  if (missing.length > 0) return { ok: false, errors: missing.map((media) => `${slug}/${STORY_FILE}: ${media} does not exist`) };
  return { ok: true, loaded: { slug, dir, story: result.story } };
}

/** Every story under `root` (folders without a story.json are skipped), sorted by slug, with all errors. */
export function loadStories(root: string = STORIES_DIR): { stories: LoadedStory[]; errors: string[] } {
  const stories: LoadedStory[] = [];
  const errors: string[] = [];
  const folders = readdirSync(root, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && existsSync(path.join(root, entry.name, STORY_FILE)))
    .map((entry) => entry.name)
    .sort();
  for (const folder of folders) {
    const result = loadStory(path.join(root, folder));
    if (result.ok) stories.push(result.loaded);
    else errors.push(...result.errors);
  }
  return { stories, errors };
}

/** Writes a story back in the repository's JSON style (two-space indent, final newline). */
export function writeStory(dir: string, story: Story): void {
  writeFileSync(path.join(dir, STORY_FILE), `${JSON.stringify(story, null, 2)}\n`);
}
