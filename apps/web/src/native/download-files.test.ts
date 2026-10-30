import { describe, expect, it } from 'vitest';
import { pilotStory } from '../story/pilot-story.test-support';
import { contentLength, downloadShare, formatBytes, storyMediaDownloads } from './download-files';

describe('story downloads', () => {
  it('fetches every media file once', () => {
    const story = pilotStory();
    expect(storyMediaDownloads(story)).toEqual([]);
    const scenes = story.scenes.map((scene) => ({ ...scene, voice: { file: `media/scenes/${scene.id}.m4a` } }));
    const files = storyMediaDownloads({ ...story, scenes, music: { ...story.music, file: 'media/music.m4a' } });
    expect(files).toHaveLength(story.scenes.length + 1);
    expect(files).toContain('media/music.m4a');
  });

  it('measures progress by bytes when every size is known, else by files', () => {
    expect(downloadShare({ filesDone: 1, files: 4, bytes: 500, total: 1000 })).toBe(0.5);
    expect(downloadShare({ filesDone: 1, files: 4, bytes: 500, total: null })).toBe(0.25);
    expect(downloadShare({ filesDone: 0, files: 0, bytes: 0, total: null })).toBe(0);
    expect(downloadShare({ filesDone: 4, files: 4, bytes: 1200, total: 1000 })).toBe(1);
  });

  it('reads sizes for people, with the decimal comma in Vietnamese', () => {
    expect(formatBytes(820_000, 'vi')).toBe('820 KB');
    expect(formatBytes(1_250_000, 'vi')).toBe('1,3 MB');
    expect(formatBytes(1_250_000, 'en')).toBe('1.3 MB');
    expect(formatBytes(42_000_000, 'en')).toBe('42 MB');
    expect(formatBytes(512, 'en')).toBe('512 B');
  });

  it('reads Content-Length in any case, and nothing else', () => {
    expect(contentLength({ 'Content-Length': '1234' })).toBe(1234);
    expect(contentLength({ 'content-length': '0' })).toBe(0);
    expect(contentLength({ 'content-length': 'x' })).toBeNull();
    expect(contentLength({})).toBeNull();
    expect(contentLength(undefined)).toBeNull();
  });
});
