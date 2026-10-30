/*
 * The stories (stories/<slug>/ at the repository root) on the site, at /stories/:
 *
 * - /stories/index.json: the story list, made from every story.json;
 * - /stories/<slug>/story.json and the media files that story.json refers to (nothing else of the folder).
 *
 * Every story is checked first (scripts/story-files.ts): an invalid story.json or a missing media file fails the
 * build, and shows as a 500 with the reason in dev.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { storyListEntry, storyMediaFiles } from '@truyen/story';
import type { Plugin } from 'vite';
import { type LoadedStory, STORY_FILE, loadStories } from '../../scripts/story-files.ts';

export const STORIES_URL = 'stories';

const CONTENT_TYPES: Record<string, string> = {
  '.json': 'application/json; charset=utf-8',
  '.webp': 'image/webp',
  '.mp4': 'video/mp4',
  '.m4a': 'audio/mp4',
};

/** URL path (no leading slash) → file or generated text of everything served under /stories/. */
export function storySiteFiles(stories: readonly LoadedStory[]): Map<string, { file: string } | { text: string }> {
  const files = new Map<string, { file: string } | { text: string }>();
  files.set(`${STORIES_URL}/index.json`, { text: `${JSON.stringify(stories.map(({ story }) => storyListEntry(story)))}\n` });
  for (const { slug, dir, story } of stories) {
    for (const name of [STORY_FILE, ...storyMediaFiles(story)]) files.set(`${STORIES_URL}/${slug}/${name}`, { file: path.join(dir, name) });
  }
  return files;
}

function loadOrThrow(): LoadedStory[] {
  const { stories, errors } = loadStories();
  if (errors.length > 0) throw new Error(`stories:\n  ${errors.join('\n  ')}`);
  return stories;
}

export function storyFiles(): Plugin {
  return {
    name: 'truyen-story-files',
    configureServer(server) {
      server.watcher.add(path.resolve(import.meta.dirname, '../../stories'));
      server.middlewares.use((req, res, next) => {
        const urlPath = decodeURIComponent(req.url?.split('?')[0] ?? '').slice(1);
        if (!urlPath.startsWith(`${STORIES_URL}/`)) {
          next();
          return;
        }
        let entry: { file: string } | { text: string } | undefined;
        try {
          // Read on each request, so an edit of story.json shows on reload.
          entry = storySiteFiles(loadOrThrow()).get(urlPath);
        } catch (error) {
          res.statusCode = 500;
          res.end(error instanceof Error ? error.message : String(error));
          return;
        }
        if (entry === undefined) {
          res.statusCode = 404;
          res.end('not found');
          return;
        }
        try {
          res.setHeader('Content-Type', CONTENT_TYPES[path.extname(urlPath)] ?? 'application/octet-stream');
          res.end('text' in entry ? entry.text : readFileSync(entry.file));
        } catch (error) {
          next(error);
        }
      });
    },
    generateBundle() {
      let stories: LoadedStory[];
      try {
        stories = loadOrThrow();
      } catch (error) {
        this.error(error instanceof Error ? error.message : String(error));
      }
      for (const [fileName, entry] of storySiteFiles(stories)) {
        this.emitFile({ type: 'asset', fileName, source: 'text' in entry ? entry.text : readFileSync(entry.file) });
      }
    },
  };
}
