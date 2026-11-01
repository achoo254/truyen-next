import type { StoryListEntry } from '@truyen/story';
import { describe, expect, it } from 'vitest';
import { nextStories } from './end-page';

const entry = (slug: string, shelf: 'kids' | 'adults'): StoryListEntry => ({ slug, shelf, title: slug, summary: '', basedOn: 'Truyện dân gian Việt Nam', scenes: 8, minutes: 4, themes: [], added: '' });
const LIST = [entry('a', 'kids'), entry('x', 'adults'), entry('b', 'kids'), entry('c', 'kids'), entry('y', 'adults')];

describe('next stories', () => {
  it('suggests the stories after this one on the same shelf, wrapping round', () => {
    expect(nextStories(LIST, { slug: 'b', shelf: 'kids' }).map((e) => e.slug)).toEqual(['c', 'a']);
    expect(nextStories(LIST, { slug: 'c', shelf: 'kids' }).map((e) => e.slug)).toEqual(['a', 'b']);
    expect(nextStories(LIST, { slug: 'x', shelf: 'adults' }).map((e) => e.slug)).toEqual(['y']);
  });

  it('never suggests a story from the other shelf, nor the story itself', () => {
    expect(nextStories([entry('only', 'kids'), entry('z', 'adults')], { slug: 'only', shelf: 'kids' })).toEqual([]);
  });
});
