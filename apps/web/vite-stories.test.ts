import { describe, expect, it } from 'vitest';
import type { StoryListEntry } from '@truyen/story';
import { loadStories } from '../../scripts/story-files.ts';
import { storySiteFiles } from './vite-stories';

describe('story files on the site', () => {
  it('serves the list and each story.json, and only the media a story refers to', () => {
    const { stories } = loadStories();
    const files = storySiteFiles(stories);
    expect([...files.keys()]).toEqual(['stories/index.json', 'stories/son-tinh-thuy-tinh/story.json']);
    const index = files.get('stories/index.json');
    const list = JSON.parse(index && 'text' in index ? index.text : '[]') as StoryListEntry[];
    expect(list).toEqual([
      expect.objectContaining({ slug: 'son-tinh-thuy-tinh', title: 'Sơn Tinh, Thủy Tinh', status: 'awaiting-text-review', scenes: 8 }),
    ]);
    const [pilot] = stories;
    if (!pilot) throw new Error('no story');
    const withMusic = { ...pilot, story: { ...pilot.story, music: { ...pilot.story.music, file: 'media/music.m4a' } } };
    expect(storySiteFiles([withMusic]).get('stories/son-tinh-thuy-tinh/media/music.m4a')).toEqual({ file: `${pilot.dir}/media/music.m4a` });
  });
});
