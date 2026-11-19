import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { type Story, validateStory } from '@truyen/story';
import { afterEach, describe, expect, it } from 'vitest';
import { LEDGER_FILE, adoptRecordings, previouslyVoiced, readLedger, sceneFingerprint, sceneVoiceFile, staleVoiceScenes, voiceFingerprint, voiceRemakes, writeLedger } from './story-voice-ledger';

function pilot(): Story {
  const raw = JSON.parse(readFileSync(new URL('../packages/story/test-fixtures/pilot-story.json', import.meta.url), 'utf8'));
  const result = validateStory(raw, 'son-tinh-thuy-tinh');
  if (!result.ok) throw new Error(result.errors.join('\n'));
  return result.story;
}

const everything = (): boolean => true;
const nothing = (): boolean => false;

describe('voiceFingerprint', () => {
  it('changes with the words and with the voice, and not otherwise', () => {
    expect(voiceFingerprint('Xin chào', 'Trúc Ly')).toBe(voiceFingerprint('Xin chào', 'Trúc Ly'));
    expect(voiceFingerprint('Xin chào', 'Trúc Ly')).not.toBe(voiceFingerprint('Xin chào bạn', 'Trúc Ly'));
    expect(voiceFingerprint('Xin chào', 'Trúc Ly')).not.toBe(voiceFingerprint('Xin chào', 'Quỳnh Anh'));
  });
});

describe('staleVoiceScenes', () => {
  it('has nothing to remake when every recording matches its ledger entry', () => {
    const story = pilot();
    const ledger = Object.fromEntries(story.scenes.map((scene) => [scene.id, sceneFingerprint(story, scene)]));
    expect(staleVoiceScenes(story, ledger, everything)).toEqual([]);
  });

  it('picks the scene whose narration was retold, and only that one', () => {
    const story = pilot();
    const ledger = Object.fromEntries(story.scenes.map((scene) => [scene.id, sceneFingerprint(story, scene)]));
    const [first, ...rest] = story.scenes;
    if (!first) throw new Error('pilot has no scene');
    const retold = { ...story, scenes: [{ ...first, narration: `${first.narration} Thêm một câu mới.` }, ...rest] };
    expect(staleVoiceScenes(retold, ledger, everything).map((scene) => scene.id)).toEqual([first.id]);
  });

  it('picks a scene whose recording file is gone, and one the ledger knows nothing about', () => {
    const story = pilot();
    expect(staleVoiceScenes(story, {}, everything)).toHaveLength(story.scenes.length);
    const ledger = Object.fromEntries(story.scenes.map((scene) => [scene.id, sceneFingerprint(story, scene)]));
    expect(staleVoiceScenes(story, ledger, nothing)).toHaveLength(story.scenes.length);
  });

  it('picks the scenes of a narrator whose voice changed', () => {
    const story = pilot();
    const ledger = Object.fromEntries(story.scenes.map((scene) => [scene.id, sceneFingerprint(story, scene)]));
    const narrators = Object.fromEntries(Object.entries(story.narrators).map(([id, narrator]) => [id, { ...narrator, voice: 'Thanh Bình' }]));
    const changed = staleVoiceScenes({ ...story, narrators }, ledger, everything);
    expect(changed.length).toBeGreaterThan(0);
  });
});

describe('adoptRecordings', () => {
  it('records today\'s text for recordings that exist, and leaves entries and missing recordings alone', () => {
    const story = pilot();
    const [first, second] = story.scenes;
    if (!first || !second) throw new Error('pilot needs two scenes');
    const existing = { [first.id]: 'old-fingerprint' };
    const adopted = adoptRecordings(story, existing, (file) => !file.includes(second.id));
    expect(adopted[first.id]).toBe('old-fingerprint');
    expect(adopted[second.id]).toBeUndefined();
    const third = story.scenes[2];
    if (!third) throw new Error('pilot needs three scenes');
    expect(adopted[third.id]).toBe(sceneFingerprint(story, third));
  });
});

describe('ledger file', () => {
  const dirs: string[] = [];
  afterEach(() => {
    for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
  });
  const temp = (): string => {
    const dir = mkdtempSync(path.join(tmpdir(), 'truyen-ledger-'));
    dirs.push(dir);
    mkdirSync(path.join(dir, 'media'));
    return dir;
  };

  it('reads as empty when absent or broken, and round-trips with its keys in order', () => {
    const dir = temp();
    expect(readLedger(dir)).toEqual({});
    writeFileSync(path.join(dir, LEDGER_FILE), '{ not json');
    expect(readLedger(dir)).toEqual({});
    writeLedger(dir, { b: '2', a: '1' });
    expect(readLedger(dir)).toEqual({ a: '1', b: '2' });
    expect(readFileSync(path.join(dir, LEDGER_FILE), 'utf8')).toBe('{\n  "a": "1",\n  "b": "2"\n}\n');
  });

  it('keeps only string entries of a ledger written by hand', () => {
    const dir = temp();
    writeFileSync(path.join(dir, LEDGER_FILE), JSON.stringify({ a: '1', b: 2, c: null }));
    expect(readLedger(dir)).toEqual({ a: '1' });
  });
});

describe('voiceRemakes', () => {
  const voicedStory = (): Story => {
    const story = pilot();
    return {
      ...story,
      track: { file: 'media/story.m4a', duration: 60, scenes: [] },
      scenes: story.scenes.map((scene) => ({ ...scene, voice: { ...scene.voice, file: sceneVoiceFile(scene) } })),
    };
  };
  const ledgerFor = (story: Story): Record<string, string> => Object.fromEntries(story.scenes.map((scene) => [scene.id, sceneFingerprint(story, scene)]));

  it('leaves a story alone when its voices match its text, and one that never had a voice', () => {
    const story = voicedStory();
    expect(voiceRemakes([{ slug: 'a', dir: 'a', story }], () => ledgerFor(story), everything)).toEqual([]);
    expect(voiceRemakes([{ slug: 'b', dir: 'b', story: pilot() }], () => ({}), nothing)).toEqual([]);
  });

  it('asks for the scenes a retelling changed', () => {
    const story = voicedStory();
    const [first, ...rest] = story.scenes;
    if (!first) throw new Error('pilot has no scene');
    const retold = { ...story, scenes: [{ ...first, narration: `${first.narration} Một câu nữa.` }, ...rest] };
    expect(voiceRemakes([{ slug: 'a', dir: 'a', story: retold }], () => ledgerFor(story), everything)).toEqual([
      { slug: 'a', dir: 'a', sceneIds: [first.id], referencesLost: false },
    ]);
  });

  it('asks for a story whose retelling dropped the recording references even though the text is the same', () => {
    const story = voicedStory();
    const bare = { ...story, track: undefined, scenes: story.scenes.map((scene) => ({ ...scene, voice: {} })) };
    const [remake] = voiceRemakes([{ slug: 'a', dir: 'a', story: bare }], () => ledgerFor(story), everything);
    expect(remake).toMatchObject({ slug: 'a', sceneIds: [], referencesLost: true });
  });
});

describe('previouslyVoiced', () => {
  it('is true with a ledger or a recording on disk, false for a story that never had a voice', () => {
    const story = pilot();
    expect(previouslyVoiced(story, {}, nothing)).toBe(false);
    expect(previouslyVoiced(story, { x: '1' }, nothing)).toBe(true);
    expect(previouslyVoiced(story, {}, everything)).toBe(true);
  });
});
