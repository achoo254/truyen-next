import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SESSION_NOT_ASKED, type SessionState, sessionStore } from '../account/session';
import { PROGRESS_LIMIT, type ProgressMap, mergeProgress, progressOf, readProgress, resumeIndex, saveProgress, withProgress } from './reading-progress';
import { SEND_DELAY_MS, flushProgress, recordProgress, startProgressSync, syncProgress } from './progress-sync';

const SIGNED_IN: SessionState = { status: 'ready', signedIn: true, signInAvailable: true, user: { name: 'A', email: null, picture: null } };
const GUEST: SessionState = { status: 'ready', signedIn: false, signInAvailable: true };

interface Sent {
  entries: Array<{ slug: string; index: number; at: number }>;
}

/** A fake /api/reading that keeps the newer record per story, like the server, and records what was sent. */
function fakeServer(initial: ProgressMap = {}): { sent: Sent[]; fetch: ReturnType<typeof vi.fn> } {
  let stored: ProgressMap = { ...initial };
  const sent: Sent[] = [];
  const fetch = vi.fn(async (_url: string, init?: RequestInit) => {
    const body = JSON.parse(String(init?.body)) as Sent;
    sent.push(body);
    for (const { slug, index, at } of body.entries) {
      const kept = stored[slug];
      if (!kept || at >= kept.at) stored = { ...stored, [slug]: { index, at } };
    }
    const entries = Object.entries(stored)
      .map(([slug, entry]) => ({ slug, ...entry }))
      .sort((a, b) => b.at - a.at);
    return new Response(JSON.stringify({ entries }), { status: 200 });
  });
  vi.stubGlobal('fetch', fetch);
  return { sent, fetch };
}

beforeEach(() => window.localStorage.clear());
afterEach(async () => {
  await flushProgress();
  sessionStore.set(SESSION_NOT_ASKED);
  window.localStorage.clear();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('merging progress', () => {
  it('keeps the later record of each story, this device on a tie, and only the newest stories', () => {
    const local: ProgressMap = { 'tam-cam': { index: 3, at: 100 }, 'cay-khe': { index: 5, at: 300 }, 'thach-sanh': { index: 2, at: 50 } };
    const remote: ProgressMap = { 'tam-cam': { index: 7, at: 200 }, 'cay-khe': { index: 1, at: 250 }, 'thach-sanh': { index: 9, at: 50 }, 'son-tinh': { index: 4, at: 10 } };
    expect(mergeProgress(local, remote)).toEqual({
      'cay-khe': { index: 5, at: 300 },
      'tam-cam': { index: 7, at: 200 },
      'thach-sanh': { index: 2, at: 50 },
      'son-tinh': { index: 4, at: 10 },
    });
    const many: ProgressMap = Object.fromEntries(Array.from({ length: PROGRESS_LIMIT + 10 }, (_, i) => [`s-${i}`, { index: 1, at: i }]));
    const merged = mergeProgress({}, many);
    expect(Object.keys(merged)).toHaveLength(PROGRESS_LIMIT);
    expect(merged).not.toHaveProperty('s-0');
  });

  it('keeps "nothing to continue" with its time, so a story finished elsewhere stops offering to continue', () => {
    const finished = withProgress({ 'tam-cam': { index: 6, at: 100 } }, 'tam-cam', 0, 200);
    expect(finished['tam-cam']).toEqual({ index: 0, at: 200 });
    expect(mergeProgress({ 'tam-cam': { index: 6, at: 100 } }, finished)['tam-cam']).toEqual({ index: 0, at: 200 });
    expect(resumeIndex(finished['tam-cam'], 10)).toBeNull();
    expect(resumeIndex({ index: 4, at: 1 }, 10)).toBe(4);
    expect(resumeIndex({ index: 10, at: 1 }, 10)).toBeNull();
    expect(resumeIndex(undefined, 10)).toBeNull();
  });
});

describe('syncing with the account', () => {
  it('never talks to the server for a guest', async () => {
    const { fetch } = fakeServer();
    sessionStore.set(GUEST);
    recordProgress('tam-cam', 3);
    await flushProgress();
    await syncProgress();
    expect(progressOf('tam-cam', 10)).toBe(3);
    expect(fetch).not.toHaveBeenCalled();
  });

  it('brings the progress of another device in, so "continue from scene N" is right here too', async () => {
    const now = Date.now();
    // The laptop read Tấm Cám up to scene 8 and finished Cây khế; this phone was behind on both.
    const { sent } = fakeServer({ 'tam-cam': { index: 7, at: now - 1000 }, 'cay-khe': { index: 0, at: now - 500 } });
    saveProgress('tam-cam', 2, now - 60_000);
    saveProgress('cay-khe', 4, now - 60_000);
    saveProgress('thach-sanh', 3, now - 2000);
    sessionStore.set(SIGNED_IN);
    await syncProgress();
    expect(sent[0]?.entries.map((entry) => entry.slug).sort()).toEqual(['cay-khe', 'tam-cam', 'thach-sanh']);
    expect(progressOf('tam-cam', 12)).toBe(7);
    expect(progressOf('cay-khe', 12)).toBeNull();
    expect(progressOf('thach-sanh', 12)).toBe(3);
  });

  it('sends what the reader records a moment later, grouped, then keeps the answer', async () => {
    vi.useFakeTimers();
    const { sent } = fakeServer();
    sessionStore.set(SIGNED_IN);
    recordProgress('tam-cam', 1);
    recordProgress('tam-cam', 2);
    recordProgress('cay-khe', 0);
    expect(sent).toHaveLength(0);
    await vi.advanceTimersByTimeAsync(SEND_DELAY_MS);
    expect(sent).toHaveLength(1);
    expect(sent[0]?.entries.map(({ slug, index }) => ({ slug, index }))).toEqual([
      { slug: 'tam-cam', index: 2 },
      { slug: 'cay-khe', index: 0 },
    ]);
    expect(readProgress()['tam-cam']?.index).toBe(2);
  });

  it('keeps the record on this device when the server cannot be reached, to send it with the next sync', async () => {
    vi.useFakeTimers();
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    vi.stubGlobal('fetch', vi.fn(async () => new Response('bad gateway', { status: 502 })));
    sessionStore.set(SIGNED_IN);
    recordProgress('tam-cam', 4);
    await vi.advanceTimersByTimeAsync(SEND_DELAY_MS);
    expect(progressOf('tam-cam', 10)).toBe(4);
    expect(warn).toHaveBeenCalledWith('progress not sent', 'http-502');
    warn.mockRestore();
  });

  it('syncs once the page learns the reader is signed in, and not for a guest', async () => {
    const { sent } = fakeServer();
    saveProgress('tam-cam', 2);
    sessionStore.set(GUEST);
    const stop = startProgressSync();
    expect(sent).toHaveLength(0);
    sessionStore.set(SIGNED_IN);
    await vi.waitFor(() => expect(sent).toHaveLength(1));
    sessionStore.set({ ...SIGNED_IN });
    await Promise.resolve();
    expect(sent).toHaveLength(1);
    stop();
  });
});
