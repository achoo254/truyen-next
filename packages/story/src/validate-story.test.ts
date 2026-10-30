import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import type { Story } from './story-schema.ts';
import { MAX_STORY_SECONDS, estimateStorySeconds, storyMediaFiles, validateStory } from './validate-story.ts';

const PILOT = new URL('../../../stories/son-tinh-thuy-tinh/story.json', import.meta.url);
const pilot = (): Story => JSON.parse(readFileSync(PILOT, 'utf8')) as Story;

function errorsOf(story: unknown, slug?: string): string[] {
  const result = validateStory(story, slug);
  return result.ok ? [] : result.errors;
}

describe('the pilot story', () => {
  it('is valid, six to ten scenes, three to six minutes, opened and closed by Mèo Miu', () => {
    const result = validateStory(pilot(), 'son-tinh-thuy-tinh');
    expect(result.ok ? [] : result.errors).toEqual([]);
    const story = pilot();
    expect(story.scenes.length).toBeGreaterThanOrEqual(6);
    expect(story.scenes.length).toBeLessThanOrEqual(10);
    expect(estimateStorySeconds(story)).toBeGreaterThanOrEqual(180);
    expect(estimateStorySeconds(story)).toBeLessThanOrEqual(360);
    expect(story.scenes[0]?.narrator).toBe('miu');
    expect(story.scenes.at(-1)?.narrator).toBe('miu');
  });

  it('refers to no media yet: nothing has been generated', () => {
    expect(storyMediaFiles(pilot())).toEqual([]);
  });
});

describe('validateStory', () => {
  it('reports shape errors with their path', () => {
    expect(errorsOf({ schemaVersion: 2 })).toContain('schemaVersion: Invalid input: expected 1');
    const story = pilot();
    expect(errorsOf({ ...story, extra: true }).join('\n')).toMatch(/extra/);
    expect(errorsOf({ ...story, slug: 'Son Tinh' })).toEqual(['slug: lowercase kebab-case']);
  });

  it('keeps media paths inside the story folder with the right type', () => {
    const story = pilot();
    const scene = story.scenes[0];
    if (!scene) throw new Error('pilot has no scene');
    for (const file of ['../secret.webp', '/etc/passwd.webp', 'media/a.png', 'media/../x.webp']) {
      expect(errorsOf({ ...story, scenes: [{ ...scene, image: { ...scene.image, file } }, ...story.scenes.slice(1)] })).not.toEqual([]);
    }
    expect(errorsOf({ ...story, scenes: [{ ...scene, image: { ...scene.image, file: 'media/scenes/mo-dau.webp' } }, ...story.scenes.slice(1)] })).toEqual([]);
    expect(errorsOf({ ...story, music: { ...story.music, file: 'media/music.mp4' } })).not.toEqual([]);
  });

  it('checks references, ids, subtitles, digits and Miu across fields', () => {
    const story = pilot();
    const [first, second, ...rest] = story.scenes;
    if (!first || !second) throw new Error('pilot has too few scenes');
    expect(errorsOf({ ...story, scenes: [{ ...first, narrator: 'ke-chuyen' }, second, ...rest] })).toEqual(['scenes.mo-dau: the opening scene is narrated by "miu"']);
    expect(errorsOf({ ...story, scenes: [first, { ...second, id: 'mo-dau' }, ...rest] })).toEqual(['scenes: id "mo-dau" is used twice']);
    expect(errorsOf({ ...story, scenes: [first, { ...second, narrator: 'ai-do' }, ...rest] })).toEqual(['scenes.vua-va-cong-chua: narrator "ai-do" is not in narrators']);
    expect(errorsOf({ ...story, scenes: [first, { ...second, image: { ...second.image, character: 'rong' } }, ...rest] })).toEqual([
      'scenes.vua-va-cong-chua.image.character: "rong" is not in characters',
    ]);
    expect(errorsOf({ ...story, scenes: [first, { ...second, subtitles: second.subtitles.slice(1) }, ...rest] })).toEqual([
      'scenes.vua-va-cong-chua.subtitles: joined, the lines must be exactly the narration',
    ]);
    const digits = { ...second, narration: 'Vua có 100 mâm xôi.', subtitles: ['Vua có 100 mâm xôi.'] };
    expect(errorsOf({ ...story, scenes: [first, digits, ...rest] })).toContain('scenes.vua-va-cong-chua.narration: write numbers as words, the voice misreads digits');
    const long = 'Một câu thật là dài '.repeat(6).trim();
    expect(errorsOf({ ...story, scenes: [first, { ...second, narration: long, subtitles: [long] }, ...rest] }).join('\n')).toMatch(/subtitles\[0\]: \d+ characters, at most 90/);
  });

  it('checks the scene count and the read-aloud length', () => {
    const story = pilot();
    expect(errorsOf({ ...story, scenes: story.scenes.slice(0, 5).concat(story.scenes.slice(-1)).slice(0, 5) }).join('\n')).toMatch(/5 scenes, expected 6–10/);
    const padded = story.scenes.map((scene) => {
      const narration = `${scene.narration} ${'la la la la la la la la la la.'.repeat(4)}`;
      return { ...scene, narration, subtitles: [...scene.subtitles, ...Array.from({ length: 4 }, () => 'la la la la la la la la la la.')] };
    });
    const longStory = { ...story, scenes: padded };
    expect(estimateStorySeconds(longStory)).toBeGreaterThan(MAX_STORY_SECONDS);
    expect(errorsOf(longStory).join('\n')).toMatch(/read aloud, expected 180–360 s/);
  });


  it('matches the slug to its folder', () => {
    expect(errorsOf(pilot(), 'other')).toEqual(['slug: "son-tinh-thuy-tinh" must match its folder "other"']);
  });
});
