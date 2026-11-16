import { estimateStorySeconds } from './validate-story.ts';
import type { Shelf, Story, Theme } from './story-schema.ts';

/** One row of the story list served at /stories/index.json, built from every story.json at dev and build time. */
export interface StoryListEntry {
  slug: string;
  shelf: Shelf;
  title: string;
  summary: string;
  /** The source in a few words ("Cốt truyện theo: …"). */
  basedOn: string;
  scenes: number;
  /** Estimated read-aloud length in whole minutes (at least one). */
  minutes: number;
  themes: Theme[];
  /** YYYY-MM-DD, or "" when the story does not say. */
  added: string;
  /** YYYY-MM-DD the story was last retold whole; absent while it is still a shortened telling. */
  revised?: string;
}

export function storyListEntry(story: Story): StoryListEntry {
  return {
    slug: story.slug,
    shelf: story.shelf,
    title: story.title,
    summary: story.summary,
    basedOn: story.basedOn,
    scenes: story.scenes.length,
    minutes: Math.max(1, Math.round(estimateStorySeconds(story) / 60)),
    themes: story.themes ?? [],
    added: story.added ?? '',
    ...(story.revised === undefined ? {} : { revised: story.revised }),
  };
}
