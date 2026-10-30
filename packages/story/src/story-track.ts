/**
 * The story as one recording (`track` in story.json): where each scene sits in it. Shared by the build script, which
 * lays the voices out, the validator, and the reader, which turns the pages by the recording's clock.
 */
import type { Scene, StoryTrack } from './story-schema.ts';

/** Music alone before the first voice. */
export const TRACK_LEAD_IN_SECONDS = 1.5;
/** Music alone between two scenes: the page turns here. */
export const TRACK_SCENE_GAP_SECONDS = 1.2;
/** Music alone after the last voice, fading out. */
export const TRACK_TAIL_SECONDS = 3;

/** Seconds are kept to the millisecond in story.json. */
const ms = (seconds: number): number => Math.round(seconds * 1000) / 1000;

/**
 * Lays the scene voices out one after another: the lead-in, each voice followed by the gap, and the tail. `voiceSeconds`
 * are the measured lengths of the scene voices, in scene order.
 */
export function layOutTrack(file: string, scenes: readonly Pick<Scene, 'id'>[], voiceSeconds: readonly number[]): StoryTrack {
  if (scenes.length === 0) throw new Error('a track needs at least one scene');
  if (voiceSeconds.length !== scenes.length) throw new Error(`${scenes.length} scenes but ${voiceSeconds.length} voice lengths`);
  let at = TRACK_LEAD_IN_SECONDS;
  const placed = scenes.map((scene, index) => {
    const seconds = voiceSeconds[index] ?? 0;
    if (!Number.isFinite(seconds) || seconds <= 0) throw new Error(`scene ${scene.id}: the voice has no length (${seconds})`);
    const start = ms(at);
    const end = ms(at + seconds);
    at = end + TRACK_SCENE_GAP_SECONDS;
    return { id: scene.id, start, end };
  });
  const last = placed[placed.length - 1];
  return { file, duration: ms((last?.end ?? 0) + TRACK_TAIL_SECONDS), scenes: placed };
}

/** The scene on at `seconds` into the recording: the last one that has started (the first one before it starts). */
export function trackSceneAt(track: StoryTrack, seconds: number): number {
  let index = 0;
  track.scenes.forEach((scene, i) => {
    if (seconds >= scene.start) index = i;
  });
  return index;
}

/** How far the voice of scene `index` has been read at `seconds` (0–1), for the subtitle line and the scene clock. */
export function trackSceneProgress(track: StoryTrack, index: number, seconds: number): number {
  const scene = track.scenes[index];
  if (!scene) return 0;
  return Math.min(1, Math.max(0, (seconds - scene.start) / (scene.end - scene.start)));
}

/** Everything wrong with a track against the story's scenes; empty when it fits. */
export function trackErrors(track: StoryTrack, scenes: readonly Pick<Scene, 'id'>[]): string[] {
  const errors: string[] = [];
  const ids = track.scenes.map((scene) => scene.id);
  const expected = scenes.map((scene) => scene.id);
  if (ids.join(',') !== expected.join(',')) errors.push(`track.scenes: must list every scene in order (${expected.join(', ')}), found ${ids.join(', ')}`);
  track.scenes.forEach((scene, index) => {
    if (scene.end <= scene.start) errors.push(`track.scenes.${scene.id}: ends at ${scene.end} s, not after its start ${scene.start} s`);
    const next = track.scenes[index + 1];
    if (next && next.start < scene.end) errors.push(`track.scenes.${next.id}: starts at ${next.start} s, before ${scene.id} ends at ${scene.end} s`);
  });
  const last = track.scenes[track.scenes.length - 1];
  if (last && last.end > track.duration) errors.push(`track: the last voice ends at ${last.end} s, after the recording's ${track.duration} s`);
  return errors;
}
