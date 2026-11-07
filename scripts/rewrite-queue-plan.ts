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

/**
 * Which of `count` shards a story belongs to, from its slug alone (FNV-1a), so parallel runs that each take one shard
 * never pick the same story, however the queue shrinks.
 */
export function shardOf(slug: string, count: number): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < slug.length; i += 1) {
    hash ^= slug.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash % count;
}

export interface Shard {
  index: number;
  count: number;
}

/** Parses "2/6" (shard two of six, counted from zero). */
export function parseShard(text: string): Shard | null {
  const match = /^(\d+)\/(\d+)$/.exec(text);
  if (!match) return null;
  const index = Number(match[1]);
  const count = Number(match[2]);
  return count > 0 && index < count ? { index, count } : null;
}

export function rewriteQueue(stories: readonly { slug: string; story: Story }[], shard?: Shard): RewriteItem[] {
  const rank = (shelf: Shelf): number => {
    const at = REWRITE_SHELF_ORDER.indexOf(shelf);
    return at >= 0 ? at : REWRITE_SHELF_ORDER.length + SHELVES.indexOf(shelf);
  };
  return stories
    .filter(({ story }) => story.revised === undefined)
    .filter(({ slug }) => shard === undefined || shardOf(slug, shard.count) === shard.index)
    .map(({ slug, story }) => ({ slug, shelf: story.shelf, seconds: Math.round(estimateStorySeconds(story)) }))
    .sort((a, b) => rank(a.shelf) - rank(b.shelf) || b.seconds - a.seconds || a.slug.localeCompare(b.slug));
}
