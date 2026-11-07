/**
 * The order in which older, shortened tellings are retold whole (docs/story-routine.md, "Viết lại truyện cũ"). A story
 * with `revised` is done. The adults' shelf goes first, then world, then kids; within a shelf the longest telling
 * first, since the stories that pressed against the old length caps are the ones cut the most.
 */
import { SHELVES, type Shelf, type Story, estimateStorySeconds } from '@truyen/story';

export const REWRITE_SHELF_ORDER: readonly Shelf[] = ['adults', 'world', 'kids'];

export interface RewriteItem {
  slug: string;
  shelf: Shelf;
  seconds: number;
}

export function rewriteQueue(stories: readonly { slug: string; story: Story }[]): RewriteItem[] {
  const rank = (shelf: Shelf): number => {
    const at = REWRITE_SHELF_ORDER.indexOf(shelf);
    return at >= 0 ? at : REWRITE_SHELF_ORDER.length + SHELVES.indexOf(shelf);
  };
  return stories
    .filter(({ story }) => story.revised === undefined)
    .map(({ slug, story }) => ({ slug, shelf: story.shelf, seconds: Math.round(estimateStorySeconds(story)) }))
    .sort((a, b) => rank(a.shelf) - rank(b.shelf) || b.seconds - a.seconds || a.slug.localeCompare(b.slug));
}
