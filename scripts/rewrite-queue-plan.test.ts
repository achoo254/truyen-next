import type { Story } from '@truyen/story';
import { describe, expect, it } from 'vitest';
import { rewriteQueue } from './rewrite-queue-plan';

function story(shelf: Story['shelf'], words: number, revised?: string): Story {
  const narration = Array.from({ length: words }, () => 'chữ').join(' ');
  return { shelf, scenes: [{ narration }], ...(revised ? { revised } : {}) } as unknown as Story;
}

describe('rewrite queue', () => {
  it('skips revised stories and orders adults, world, kids, longest first', () => {
    const queue = rewriteQueue([
      { slug: 'be-ngan', story: story('kids', 100) },
      { slug: 'the-gioi', story: story('world', 300) },
      { slug: 'nguoi-lon-ngan', story: story('adults', 200) },
      { slug: 'nguoi-lon-dai', story: story('adults', 900) },
      { slug: 'da-viet-lai', story: story('adults', 2000, '2026-11-08') },
    ]);
    expect(queue.map((item) => item.slug)).toEqual(['nguoi-lon-dai', 'nguoi-lon-ngan', 'the-gioi', 'be-ngan']);
  });
});
