import { BACKDROP_FRAMES, READING_SCENES, READING_SCENE_STYLE, readingScene, sceneMood } from '@truyen/story';
import { describe, expect, it } from 'vitest';
import { backdropSeed, planReadingScenes } from './reading-scenes-plan';

const TOOLS = { python: 'python3', artgenDir: '/tools/inet-artgen/' };

describe('reading scene backdrops', () => {
  it('draws every scene variant once per frame shape, and exports each size as AVIF and WebP', () => {
    const steps = planReadingScenes(TOOLS);
    const variants = READING_SCENES.reduce((sum, scene) => sum + Object.keys(scene.prompts).length, 0);
    expect(variants).toBe(9);
    expect(steps).toHaveLength(variants * BACKDROP_FRAMES.length);
    expect(steps.flatMap((step) => step.outputs)).toHaveLength(variants * 6 * 2);
    expect(steps.some((step) => step.scene === 'giay-tron')).toBe(false);
  });

  it('sends the shared style, the scene prompt, qwen, the draw size and a stable seed', () => {
    const [step] = planReadingScenes(TOOLS, 'giuong-ngu');
    if (!step) throw new Error('no step');
    expect(step.id).toBe('giuong-ngu:night:phone');
    const [draw, resize, avif, webp] = step.commands;
    expect(draw?.slice(0, 2)).toEqual(['python3', '/tools/inet-artgen/artgen.py']);
    expect(draw?.[2]).toMatch(new RegExp(`^${READING_SCENE_STYLE.slice(0, 40)}`));
    expect(draw?.[2]).toContain('crescent-moon night light');
    expect(draw?.slice(3)).toEqual(['-w', 'qwen', '--size', '832x1808', '--seed', String(backdropSeed('giuong-ngu', 'night')), '-o', '.work/reading-scenes/giuong-ngu-night-phone.png']);
    expect(resize).toContain('scale=1125:2436:flags=lanczos');
    expect(avif?.at(-1)).toBe('apps/web/public/reading-scenes/giuong-ngu-night-1125x2436.avif');
    expect(webp?.at(-1)).toBe('apps/web/public/reading-scenes/giuong-ngu-night-1125x2436.webp');
    expect(backdropSeed('giuong-ngu', 'night')).toBe(backdropSeed('giuong-ngu', 'night'));
    expect(backdropSeed('giuong-ngu', 'night')).not.toBe(backdropSeed('ban-go', 'night'));
  });

  it('only lists as drawn a mood the scene is painted in', () => {
    for (const scene of READING_SCENES) for (const mood of scene.drawn) expect(Object.keys(scene.prompts)).toContain(mood);
  });

  it('shows the night variant with the lights off when there is one', () => {
    expect(sceneMood(readingScene('ban-go'), true)).toBe('night');
    expect(sceneMood(readingScene('ban-go'), false)).toBe('day');
    expect(sceneMood(readingScene('san-dinh-trang'), false)).toBe('night');
    expect(sceneMood(readingScene('goc-da'), true)).toBe('day');
    expect(sceneMood(readingScene('giay-tron'), true)).toBeNull();
  });
});
