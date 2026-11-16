import { describe, expect, it } from 'vitest';
import type { Story } from './story-schema.ts';
import { storyListEntry } from './story-list.ts';

const base = {
  slug: 'tam-cam',
  shelf: 'kids',
  title: 'Tấm Cám',
  summary: 'Cô Tấm hiền lành.',
  basedOn: 'Truyện dân gian Việt Nam',
  scenes: [{ narration: 'Ngày xưa có cô Tấm.' }],
  added: '2026-10-30',
} as unknown as Story;

describe('story list entry', () => {
  it('carries the date a story was retold whole, so the progress of the rewrite can be read from the site', () => {
    expect(storyListEntry({ ...base, revised: '2026-11-08' } as Story).revised).toBe('2026-11-08');
  });

  it('leaves the field out while a story is still a shortened telling', () => {
    expect('revised' in storyListEntry(base)).toBe(false);
  });
});
