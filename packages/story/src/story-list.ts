import { estimateStorySeconds } from './validate-story.ts';
import type { Story } from './story-schema.ts';

/** One row of the story list served at /stories/index.json, built from every story.json at dev and build time. */
export interface StoryListEntry {
  slug: string;
  title: string;
  summary: string;
  scenes: number;
  /** Estimated read-aloud length in whole minutes (at least one). */
  minutes: number;
}

export function storyListEntry(story: Story): StoryListEntry {
  return {
    slug: story.slug,
    title: story.title,
    summary: story.summary,
    scenes: story.scenes.length,
    minutes: Math.max(1, Math.round(estimateStorySeconds(story) / 60)),
  };
}
