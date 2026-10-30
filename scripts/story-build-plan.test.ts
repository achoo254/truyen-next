import { readFileSync } from 'node:fs';
import type { Story } from '@truyen/story';
import { describe, expect, it } from 'vitest';
import { MOTION_SIZE, STILL_SIZE, applyRecord, planStoryBuild, shellQuote } from './story-build-plan';

const pilot = (): Story => JSON.parse(readFileSync(new URL('../stories/son-tinh-thuy-tinh/story.json', import.meta.url), 'utf8')) as Story;
const TOOLS = { python: 'python3', artgenDir: '/skills/inet-artgen/' };
const ARTGEN = ['python3', '/skills/inet-artgen/artgen.py'];

describe('story build plan', () => {
  it('plans every character sheet, scene still, motion clip, voice, the music and the social clip', () => {
    const story = pilot();
    const steps = planStoryBuild(story, TOOLS);
    const n = story.scenes.length;
    expect(steps).toHaveLength(story.characters.length + 3 * n + 2);
    expect(steps.filter((s) => s.stage === 'videos')).toHaveLength(n);
    expect(new Set(steps.map((s) => s.output)).size).toBe(steps.length);
  });

  it('draws Mèo Miu from the Miu World render and the others with qwen', () => {
    const [miu, king] = planStoryBuild(pilot(), TOOLS, ['characters']);
    expect(miu?.commands[0]).toEqual([
      ...ARTGEN,
      expect.stringMatching(/^Meo Miu, .*character reference sheet\. Vietnamese folk-tale picture-book/),
      '-w', 'klein-edit', '--ref', '../miu-world-next/assets/generated/review/character/miu-cat-anim-idle.png',
      '--size', '1104x1472', '--seed', '41001', '-o', '.work/son-tinh-thuy-tinh/characters/miu.png',
    ]);
    expect(miu?.commands[1]).toEqual(['cwebp', '-quiet', '-q', '88', '.work/son-tinh-thuy-tinh/characters/miu.png', '-o', 'stories/son-tinh-thuy-tinh/media/characters/miu.webp']);
    expect(miu?.inputs).toEqual(['../miu-world-next/assets/generated/review/character/miu-cat-anim-idle.png']);
    expect(king?.commands[0]?.slice(3, 5)).toEqual(['-w', 'qwen']);
    expect(king?.record).toEqual({ kind: 'character', id: 'vua-hung', file: 'media/characters/vua-hung.webp' });
  });

  it('draws each still from its character sheet and moves it with wan-i2v, then upscales', () => {
    const steps = planStoryBuild(pilot(), TOOLS, ['images', 'videos']);
    const image = steps.find((s) => s.id === 'images:mo-dau');
    expect(image?.commands[0]).toContain('klein-edit');
    expect(image?.commands[0]).toEqual(expect.arrayContaining(['--ref', 'stories/son-tinh-thuy-tinh/media/characters/miu.webp', '--size', STILL_SIZE, '--seed', '52001']));
    expect(image?.inputs).toEqual(['stories/son-tinh-thuy-tinh/media/characters/miu.webp']);
    const video = steps.find((s) => s.id === 'videos:mo-dau');
    expect(video?.commands[0]).toEqual([
      ...ARTGEN, expect.stringMatching(/^light rain/), '-w', 'wan-i2v', '--ref', 'stories/son-tinh-thuy-tinh/media/scenes/mo-dau.webp',
      '--size', MOTION_SIZE, '--seed', '63001', '-o', '.work/son-tinh-thuy-tinh/scenes/mo-dau-720.mp4',
    ]);
    expect(video?.commands[1]).toEqual([...ARTGEN, '-', '-w', 'video-upscale', '--ref', '.work/son-tinh-thuy-tinh/scenes/mo-dau-720.mp4', '-o', '.work/son-tinh-thuy-tinh/scenes/mo-dau-1080.mp4']);
    expect(video?.commands[2]).toEqual(expect.arrayContaining(['-an', '-movflags', '+faststart', 'stories/son-tinh-thuy-tinh/media/scenes/mo-dau.mp4']));
  });

  it('reads each scene with its narrator voice: Trúc Ly for Mèo Miu, Quỳnh Anh for the storyteller', () => {
    const steps = planStoryBuild(pilot(), TOOLS, ['voices']);
    const story = pilot();
    expect(steps[0]?.commands[0]).toEqual(['python3', '/skills/inet-artgen/voice.py', story.scenes[0]?.narration, '-o', '.work/son-tinh-thuy-tinh/scenes/mo-dau.wav', '--voice', 'Trúc Ly']);
    expect(steps[1]?.commands[0]?.at(-1)).toBe('Quỳnh Anh');
    expect(steps[0]?.pc).toBe('voice');
  });

  it('reads an adults\' story with its one storyteller voice and draws no Mèo Miu', () => {
    const story = JSON.parse(readFileSync(new URL('../stories/su-tich-ho-guom/story.json', import.meta.url), 'utf8')) as Story;
    const voices = planStoryBuild(story, TOOLS, ['voices']).map((step) => step.commands[0]?.at(-1));
    expect(new Set(voices)).toEqual(new Set(['Thanh Bình']));
    const sheets = planStoryBuild(story, TOOLS, ['characters']);
    expect(sheets.every((step) => step.commands[0]?.includes('qwen'))).toBe(true);
    expect(sheets.map((step) => step.id)).not.toContain('characters:miu');
  });

  it('makes one music bed and a social clip from every upscaled clip, the title and the music', () => {
    const [music, social] = planStoryBuild(pilot(), TOOLS, ['music', 'social']);
    expect(music?.commands[0]).toEqual([...ARTGEN, expect.stringMatching(/lullaby/), '-w', 'ace-music', '--duration', '120', '--seed', '74001', '-o', '.work/son-tinh-thuy-tinh/music.mp3']);
    expect(social?.commands[0]?.slice(0, 3)).toEqual(['python3', '/skills/inet-artgen/video-finish.py', '.work/son-tinh-thuy-tinh/scenes/mo-dau-1080.mp4']);
    expect(social?.commands[0]?.slice(-6)).toEqual(['--text', 'Sơn Tinh, Thủy Tinh', '--music', '.work/son-tinh-thuy-tinh/music.mp3', '-o', '.work/son-tinh-thuy-tinh/social.mp4']);
    expect(social?.pc).toBeNull();
    expect(social?.record).toBeUndefined();
  });

  it('records a finished file in the story without changing the input', () => {
    const story = pilot();
    const updated = applyRecord(story, { kind: 'voice', id: 'mo-dau', file: 'media/scenes/mo-dau.m4a' });
    expect(updated.scenes[0]?.voice.file).toBe('media/scenes/mo-dau.m4a');
    expect(story.scenes[0]?.voice.file).toBeUndefined();
    expect(applyRecord(story, { kind: 'music', file: 'media/music.m4a' }).music.file).toBe('media/music.m4a');
    expect(applyRecord(story, { kind: 'character', id: 'miu', file: 'media/characters/miu.webp' }).characters[0]?.file).toBe('media/characters/miu.webp');
  });

  it('quotes commands for printing', () => {
    expect(shellQuote(['python3', 'a b', "it's", '-o', 'x/y.png'])).toBe(`python3 'a b' 'it'\\''s' -o x/y.png`);
  });
});
