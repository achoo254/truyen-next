import { describe, expect, it } from 'vitest';
import { newestPerSlug } from './reading-store';

describe('newest record per story', () => {
  const now = new Date('2026-11-02T08:00:00Z');
  const t = now.getTime();

  it('keeps the later record of each story, the incoming one on a tie', () => {
    expect(
      newestPerSlug(
        [
          { slug: 'tam-cam', index: 2, at: t - 5000 },
          { slug: 'tam-cam', index: 6, at: t - 1000 },
          { slug: 'tam-cam', index: 3, at: t - 3000 },
          { slug: 'cay-khe', index: 1, at: t - 2000 },
          { slug: 'cay-khe', index: 4, at: t - 2000 },
        ],
        now,
      ),
    ).toEqual([
      { slug: 'tam-cam', index: 6, at: t - 1000 },
      { slug: 'cay-khe', index: 4, at: t - 2000 },
    ]);
  });

  it('counts a time in the future as now', () => {
    expect(newestPerSlug([{ slug: 'tam-cam', index: 2, at: t + 86_400_000 }], now)).toEqual([{ slug: 'tam-cam', index: 2, at: t }]);
  });
});
