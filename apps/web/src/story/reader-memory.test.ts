import { afterEach, describe, expect, it } from 'vitest';
import { DEFAULT_PREFS, parsePrefs } from './reader-prefs';
import { PROGRESS_KEY, PROGRESS_LIMIT, forgetProgress, parseProgress, progressOf, saveProgress, sceneFromQuery, withProgress } from './reading-progress';
import { fadeShare, minutesLeft, sleepDeadline } from './sleep-timer';

afterEach(() => window.localStorage.clear());

describe('reader preferences', () => {
  it('keeps valid fields and falls back for the rest', () => {
    expect(parsePrefs(null)).toEqual(DEFAULT_PREFS);
    expect(parsePrefs({ autoTurn: false, textSize: 'l', rate: 1.25, subtitles: false, scenes: { kids: 'giuong-ngu', adults: 'nope' } })).toEqual({
      autoTurn: false,
      textSize: 'l',
      rate: 1.25,
      subtitles: false,
      scenes: { kids: 'giuong-ngu', adults: 'ban-go' },
    });
    expect(parsePrefs({ autoTurn: 'no', textSize: 'xl', rate: 3, subtitles: 1 })).toEqual(DEFAULT_PREFS);
  });
});

describe('reading progress', () => {
  it('remembers the scene to continue from, and forgets a story not started or finished', () => {
    saveProgress('tam-cam', 4);
    expect(progressOf('tam-cam', 10)).toBe(4);
    expect(progressOf('tam-cam', 4)).toBeNull();
    saveProgress('tam-cam', 0);
    expect(progressOf('tam-cam', 10)).toBeNull();
    saveProgress('cay-khe', 2);
    forgetProgress('cay-khe');
    expect(progressOf('cay-khe', 8)).toBeNull();
  });

  it('drops malformed entries and keeps only the newest stories', () => {
    window.localStorage.setItem(PROGRESS_KEY, '{"a":{"index":2,"at":5},"b":{"index":-1,"at":5},"c":"x"}');
    expect(parseProgress(JSON.parse(window.localStorage.getItem(PROGRESS_KEY) ?? '{}'))).toEqual({ a: { index: 2, at: 5 } });
    window.localStorage.setItem(PROGRESS_KEY, 'not json');
    expect(progressOf('a', 5)).toBeNull();
    let map = {};
    for (let i = 0; i < PROGRESS_LIMIT + 5; i += 1) map = withProgress(map, `s${i}`, 1, i);
    expect(Object.keys(map)).toHaveLength(PROGRESS_LIMIT);
    expect(map).not.toHaveProperty('s0');
  });

  it('reads ?canh= as a 1-based scene in range', () => {
    expect(sceneFromQuery('?canh=5', 8)).toBe(4);
    expect(sceneFromQuery('?canh=1', 8)).toBe(0);
    for (const search of ['', '?canh=0', '?canh=9', '?canh=2.5', '?canh=-1', '?canh=x']) expect(sceneFromQuery(search, 8)).toBeNull();
  });
});

describe('sleep timer', () => {
  it('runs out after the minutes picked; off and end have no clock', () => {
    expect(sleepDeadline(10, 1000)).toBe(1000 + 600_000);
    expect(sleepDeadline('off', 1000)).toBeNull();
    expect(sleepDeadline('end', 1000)).toBeNull();
    expect(minutesLeft(1000 + 61_000, 1000)).toBe(2);
    expect(minutesLeft(0, 1000)).toBe(0);
  });

  it('fades from full to silent over the fade', () => {
    expect(fadeShare(0, 0)).toBe(1);
    expect(fadeShare(0, 5000)).toBeCloseTo(0.5);
    expect(fadeShare(0, 20_000)).toBe(0);
  });
});
