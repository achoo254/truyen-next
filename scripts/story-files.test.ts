import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { STORIES_DIR, loadStories, loadStory, writeStory } from './story-files';

const dirs: string[] = [];
function tempStories(): string {
  const dir = mkdtempSync(path.join(tmpdir(), 'truyen-stories-'));
  dirs.push(dir);
  cpSync(path.join(STORIES_DIR, 'son-tinh-thuy-tinh'), path.join(dir, 'son-tinh-thuy-tinh'), { recursive: true });
  return dir;
}
afterEach(() => {
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

describe('story files', () => {
  it('loads the stories of the repository', () => {
    const { stories, errors } = loadStories();
    expect(errors).toEqual([]);
    expect(stories.map((s) => s.slug)).toContain('son-tinh-thuy-tinh');
  });

  it('reports a media path whose file does not exist, and accepts it once the file is there', () => {
    const root = tempStories();
    const dir = path.join(root, 'son-tinh-thuy-tinh');
    const first = loadStory(dir);
    if (!first.ok) throw new Error(first.errors.join('\n'));
    writeStory(dir, { ...first.loaded.story, music: { ...first.loaded.story.music, file: 'media/music.m4a' } });
    expect(loadStory(dir)).toEqual({ ok: false, errors: ['son-tinh-thuy-tinh/story.json: media/music.m4a does not exist'] });
    mkdirSync(path.join(dir, 'media'));
    writeFileSync(path.join(dir, 'media/music.m4a'), 'audio');
    expect(loadStory(dir).ok).toBe(true);
    expect(readFileSync(path.join(dir, 'story.json'), 'utf8').endsWith('}\n')).toBe(true);
  });

  it('reports broken JSON and a folder name that is not the slug', () => {
    const root = tempStories();
    cpSync(path.join(root, 'son-tinh-thuy-tinh'), path.join(root, 'ban-sao'), { recursive: true });
    writeFileSync(path.join(root, 'son-tinh-thuy-tinh', 'story.json'), '{ not json');
    const { stories, errors } = loadStories(root);
    expect(stories).toEqual([]);
    expect(errors).toHaveLength(2);
    expect(errors[0]).toBe('ban-sao/story.json slug: "son-tinh-thuy-tinh" must match its folder "ban-sao"');
    expect(errors[1]).toMatch(/^son-tinh-thuy-tinh\/story\.json: /);
  });
});
