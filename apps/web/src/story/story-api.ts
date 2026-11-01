/** Reads the story list and a story from the site, checked at the boundary like any outside data. */
import { SHELVES, type Shelf, type Story, type StoryListEntry, THEMES, storyListEntry, validateStory } from '@truyen/story';
import { offlineSlugs, storyFileUrl, storyListUrl } from './story-location';

export class StoryLoadError extends Error {
  constructor(
    message: string,
    readonly notFound = false,
  ) {
    super(message);
  }
}

async function getJson(url: string, signal?: AbortSignal): Promise<unknown> {
  const response = await fetch(url, { signal, headers: { Accept: 'application/json' } });
  if (response.status === 404) throw new StoryLoadError(`${url}: not found`, true);
  if (!response.ok) throw new StoryLoadError(`${url}: HTTP ${response.status}`);
  return response.json();
}

function isListEntry(value: unknown): value is StoryListEntry {
  if (typeof value !== 'object' || value === null) return false;
  const entry = value as Record<string, unknown>;
  return (
    typeof entry.slug === 'string' &&
    (SHELVES as readonly unknown[]).includes(entry.shelf) &&
    typeof entry.title === 'string' &&
    typeof entry.summary === 'string' &&
    typeof entry.scenes === 'number' &&
    typeof entry.minutes === 'number' &&
    Array.isArray(entry.themes) &&
    entry.themes.every((theme) => (THEMES as readonly unknown[]).includes(theme)) &&
    typeof entry.added === 'string'
  );
}

/**
 * The story list of the site. When the site cannot be reached and stories are kept on the phone (the app's downloads),
 * the list of those stories instead, so the shelves still open in airplane mode.
 */
export async function fetchStoryList(signal?: AbortSignal): Promise<StoryListEntry[]> {
  const url = storyListUrl();
  try {
    const data = await getJson(url, signal);
    if (!Array.isArray(data) || !data.every(isListEntry)) throw new StoryLoadError(`${url}: not a story list`);
    return data;
  } catch (error) {
    if (signal?.aborted || offlineSlugs().length === 0) throw error;
    console.warn('story list unavailable, showing the downloaded stories', error instanceof Error ? error.message : error);
    return offlineStoryList(signal);
  }
}

/** The list entries of the stories kept on the phone, read from their own story.json. */
export async function offlineStoryList(signal?: AbortSignal): Promise<StoryListEntry[]> {
  const stories = await Promise.all(offlineSlugs().map((slug) => fetchStory(slug, signal)));
  return stories.map(storyListEntry);
}

export async function fetchStory(slug: string, signal?: AbortSignal): Promise<Story> {
  const url = storyFileUrl(slug, 'story.json');
  const result = validateStory(await getJson(url, signal), slug);
  if (!result.ok) throw new StoryLoadError(`${url}: ${result.errors.join('; ')}`);
  return result.story;
}

/** `/truyen/<slug>`: the reading page of a story. */
export const STORY_PATH_PREFIX = '/truyen/';

export function storyPath(slug: string): string {
  return `${STORY_PATH_PREFIX}${encodeURIComponent(slug)}`;
}

/** The slug of a story page path, or null for any other path. */
export function parseStoryPath(path: string): string | null {
  if (!path.startsWith(STORY_PATH_PREFIX)) return null;
  const slug = path.slice(STORY_PATH_PREFIX.length);
  return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) ? slug : null;
}

/**
 * Each shelf on a page of its own: `/tre-em` (children's stories only, the way in from Miu World), `/nguoi-lon` and
 * `/the-gioi`. The home page shows every shelf, children's first.
 */
export const SHELF_PATHS: Record<Shelf, string> = { kids: '/tre-em', adults: '/nguoi-lon', world: '/the-gioi' };

export function shelfPath(shelf: Shelf): string {
  return SHELF_PATHS[shelf];
}

/** The shelf of a shelf page path, or null for any other path. */
export function parseShelfPath(path: string): Shelf | null {
  return SHELVES.find((shelf) => SHELF_PATHS[shelf] === path) ?? null;
}
