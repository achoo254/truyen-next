import type { Story } from '@truyen/story';
import { describe, expect, it } from 'vitest';
import { parseShard, rewriteQueue, shardOf } from './rewrite-queue-plan';

function story(shelf: Story['shelf'], words: number, revised?: string): Story {
  const narration = Array.from({ length: words }, () => 'chữ').join(' ');
  return { shelf, scenes: [{ narration }], ...(revised ? { revised } : {}) } as unknown as Story;
}

const STORIES = [
  { slug: 'be-ngan', story: story('kids', 100) },
  { slug: 'the-gioi', story: story('world', 300) },
  { slug: 'nguoi-lon-ngan', story: story('adults', 200) },
  { slug: 'nguoi-lon-dai', story: story('adults', 900) },
  { slug: 'da-viet-lai', story: story('adults', 2000, '2026-11-08') },
];

describe('rewrite queue', () => {
  it('skips revised stories and orders adults, world, kids, longest first', () => {
    expect(rewriteQueue(STORIES).map((item) => item.slug)).toEqual(['nguoi-lon-dai', 'nguoi-lon-ngan', 'the-gioi', 'be-ngan']);
  });

  it('splits the queue into shards that cover every story exactly once', () => {
    const shards = [0, 1, 2].map((index) => rewriteQueue(STORIES, { index, count: 3 }).map((item) => item.slug));
    expect(shards.flat().sort()).toEqual(rewriteQueue(STORIES).map((item) => item.slug).sort());
    for (const slug of shards[1] ?? []) expect(shardOf(slug, 3)).toBe(1);
  });

  it('reads a shard as i/n with i below n', () => {
    expect(parseShard('2/6')).toEqual({ index: 2, count: 6 });
    expect(parseShard('6/6')).toBeNull();
    expect(parseShard('x')).toBeNull();
  });
});
