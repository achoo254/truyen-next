/** Reads the story list and a story from the site, checked at the boundary like any outside data. */
import { type Story, type StoryListEntry, STORY_STATUSES, validateStory } from '@truyen/story';
import { storyFileUrl } from './scene-media';

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
    typeof entry.title === 'string' &&
    typeof entry.summary === 'string' &&
    (STORY_STATUSES as readonly unknown[]).includes(entry.status) &&
    typeof entry.scenes === 'number' &&
    typeof entry.minutes === 'number'
  );
}

export async function fetchStoryList(signal?: AbortSignal): Promise<StoryListEntry[]> {
  const data = await getJson('/stories/index.json', signal);
  if (!Array.isArray(data) || !data.every(isListEntry)) throw new StoryLoadError('/stories/index.json: not a story list');
  return data;
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
