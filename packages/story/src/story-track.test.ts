import { describe, expect, it } from 'vitest';
import { TRACK_LEAD_IN_SECONDS, TRACK_SCENE_GAP_SECONDS, TRACK_TAIL_SECONDS, layOutTrack, trackErrors, trackSceneAt, trackSceneProgress } from './story-track.ts';

const scenes = [{ id: 'mo-dau' }, { id: 'giua' }, { id: 'ket' }];

describe('story track layout', () => {
  it('puts each voice after the lead-in and the previous voice plus the gap, then the tail', () => {
    const track = layOutTrack('media/story.m4a', scenes, [2.5, 4, 1.25]);
    const lead = TRACK_LEAD_IN_SECONDS;
    const gap = TRACK_SCENE_GAP_SECONDS;
    expect(track.scenes).toEqual([
      { id: 'mo-dau', start: lead, end: lead + 2.5 },
      { id: 'giua', start: lead + 2.5 + gap, end: lead + 6.5 + gap },
      { id: 'ket', start: lead + 6.5 + 2 * gap, end: lead + 7.75 + 2 * gap },
    ]);
    expect(track.duration).toBeCloseTo(lead + 7.75 + 2 * gap + TRACK_TAIL_SECONDS, 6);
    expect(trackErrors(track, scenes)).toEqual([]);
  });

  it('keeps times to the millisecond', () => {
    const track = layOutTrack('media/story.m4a', scenes, [1.0004444, 2.33333333, 1]);
    for (const scene of track.scenes) {
      expect(scene.start * 1000).toBe(Math.round(scene.start * 1000));
      expect(scene.end * 1000).toBe(Math.round(scene.end * 1000));
    }
  });

  it('refuses a voice without length and a count that does not match the scenes', () => {
    expect(() => layOutTrack('media/story.m4a', scenes, [1, 0, 1])).toThrow('scene giua: the voice has no length (0)');
    expect(() => layOutTrack('media/story.m4a', scenes, [1, Number.NaN, 1])).toThrow(/no length/);
    expect(() => layOutTrack('media/story.m4a', scenes, [1, 2])).toThrow('3 scenes but 2 voice lengths');
    expect(() => layOutTrack('media/story.m4a', [], [])).toThrow(/at least one scene/);
  });
});

describe('reading a story track', () => {
  const track = layOutTrack('media/story.m4a', scenes, [10, 10, 10]);

  it('finds the scene on at a moment: the first before it starts, each one until the next starts', () => {
    expect(trackSceneAt(track, 0)).toBe(0);
    expect(trackSceneAt(track, track.scenes[0]?.end ?? 0)).toBe(0);
    expect(trackSceneAt(track, (track.scenes[1]?.start ?? 0) - 0.01)).toBe(0);
    expect(trackSceneAt(track, track.scenes[1]?.start ?? 0)).toBe(1);
    expect(trackSceneAt(track, track.duration)).toBe(2);
  });

  it('says how far a scene voice has been read', () => {
    const start = track.scenes[1]?.start ?? 0;
    expect(trackSceneProgress(track, 1, start - 1)).toBe(0);
    expect(trackSceneProgress(track, 1, start + 5)).toBeCloseTo(0.5, 6);
    expect(trackSceneProgress(track, 1, start + 10.5)).toBe(1);
    expect(trackSceneProgress(track, 9, start)).toBe(0);
  });
});
