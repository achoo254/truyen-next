import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { TRACK_LEAD_IN_SECONDS, TRACK_SCENE_GAP_SECONDS, TRACK_TAIL_SECONDS, validateStory } from '@truyen/story';
import { afterEach, describe, expect, it } from 'vitest';
import { makeFixtureStory, makeTone, trackStep } from './fixture-story';
import { TRACK_FILE } from './story-build-plan';
import { makeStoryTrack, probeSeconds } from './story-build-run';

const dirs: string[] = [];
function tempDir(): string {
  const dir = mkdtempSync(path.join(tmpdir(), 'truyen-track-'));
  dirs.push(dir);
  return dir;
}
afterEach(() => {
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

/** Mean loudness (dB) of `seconds` of `file` from `from`, by ffmpeg's volumedetect. */
function meanVolume(file: string, from: number, seconds: number): number {
  const ran = spawnSync('ffmpeg', ['-v', 'info', '-ss', String(from), '-t', String(seconds), '-i', file, '-af', 'volumedetect', '-f', 'null', '-'], { encoding: 'utf8' });
  const match = /mean_volume: (-?[\d.]+|-inf) dB/.exec(ran.stderr);
  if (!match?.[1]) throw new Error(`no volumedetect output for ${file}: ${ran.stderr.slice(-300)}`);
  return match[1] === '-inf' ? -Infinity : Number(match[1]);
}

describe('the story recording, mixed from test tones', () => {
  it('places every voice at its measured start, the music alone (and turned down) between them', () => {
    const dir = tempDir();
    const voices = [path.join(dir, 'a.m4a'), path.join(dir, 'b.m4a')];
    makeTone(voices[0] ?? '', 1, 440);
    makeTone(voices[1] ?? '', 2, 660);
    const music = path.join(dir, 'music.m4a');
    // Shorter than the recording: it has to loop.
    makeTone(music, 1.5, 196, 0.4);
    const output = path.join(dir, 'story.m4a');

    const track = makeStoryTrack(trackStep(voices, music, output), [{ id: 'a' }, { id: 'b' }], TRACK_FILE);

    const [a, b] = track.scenes;
    if (!a || !b) throw new Error('two scenes expected');
    expect(a.start).toBe(TRACK_LEAD_IN_SECONDS);
    // The measured length of an AAC file is a little over the tone (encoder padding), never under.
    expect(a.end - a.start).toBeGreaterThanOrEqual(1);
    expect(a.end - a.start).toBeLessThan(1.1);
    expect(b.start).toBeCloseTo(a.end + TRACK_SCENE_GAP_SECONDS, 6);
    expect(track.duration).toBeCloseTo(b.end + TRACK_TAIL_SECONDS, 6);
    expect(Math.abs(probeSeconds(output) - track.duration)).toBeLessThan(0.1);

    const voiceA = meanVolume(output, a.start + 0.2, 0.6);
    const voiceB = meanVolume(output, b.start + 0.2, 1.5);
    const gap = meanVolume(output, a.end + 0.3, TRACK_SCENE_GAP_SECONDS - 0.5);
    const tail = meanVolume(output, b.end + 0.3, 1);
    expect(voiceA).toBeGreaterThan(gap + 12);
    expect(voiceB).toBeGreaterThan(gap + 12);
    // The music plays between the voices and after them: there is sound, quieter than a voice.
    expect(gap).toBeGreaterThan(-45);
    expect(tail).toBeGreaterThan(-45);
  });

  it('writes a fixture story whose recording passes the story checks', () => {
    const dir = tempDir();
    const story = makeFixtureStory(path.join(dir, 'stories'), 'son-tinh-thuy-tinh', 0.5);
    const folder = path.join(dir, 'stories', 'son-tinh-thuy-tinh');
    expect(existsSync(path.join(folder, TRACK_FILE))).toBe(true);
    expect(story.track?.scenes).toHaveLength(story.scenes.length);
    const written: unknown = JSON.parse(readFileSync(path.join(folder, 'story.json'), 'utf8'));
    const result = validateStory(written, 'son-tinh-thuy-tinh');
    expect(result.ok ? [] : result.errors).toEqual([]);
  });
});
