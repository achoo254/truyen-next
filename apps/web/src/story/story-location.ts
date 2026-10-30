/**
 * Where a story's files are: on the site (`<origin>/stories/<slug>/…`, the origin '' on the web), or on the phone once
 * the app has downloaded the story (a local address of the app). Everything that loads a story file, story.json
 * included, asks here, so a downloaded story plays with no network and nothing else needs to know.
 */
import { STORY_ORIGIN } from '../platform/app-build';

/** Downloaded stories: slug → local folder address ending in "/". */
const offline = new Map<string, string>();

export function rememberOfflineCopy(slug: string, folder: string): void {
  offline.set(slug, folder.endsWith('/') ? folder : `${folder}/`);
}

export function forgetOfflineCopy(slug: string): void {
  offline.delete(slug);
}

/** The slugs of the stories kept on the phone. */
export function offlineSlugs(): string[] {
  return [...offline.keys()].sort();
}

/** The site address of a file of the story folder (`media/…` or `story.json`), even when a copy is on the phone. */
export function storyRemoteUrl(slug: string, file: string, origin: string = STORY_ORIGIN): string {
  return `${origin}/stories/${encodeURIComponent(slug)}/${file}`;
}

/** The address to load a file of the story folder from: the phone's copy when there is one, else the site. */
export function storyFileUrl(slug: string, file: string): string {
  const folder = offline.get(slug);
  return folder === undefined ? storyRemoteUrl(slug, file) : `${folder}${file}`;
}

export function storyListUrl(origin: string = STORY_ORIGIN): string {
  return `${origin}/stories/index.json`;
}
