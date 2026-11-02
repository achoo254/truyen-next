/**
 * Where each story was left (localStorage `truyen:progress`): the scene to continue from and when. Index 0 means
 * "nothing to continue" (not past the first scene, or read to the end) and is kept with its time, so a story read to
 * its end on one device also stops offering "continue" on the others once they sync (story/progress-sync.ts). Kept for
 * the 50 most recent stories. A guest's progress lives here only, as it always did.
 */
import { useSyncExternalStore } from 'react';
import { isRecord, readStored, readStoredText, writeStored } from '../ui/local-store';

export const PROGRESS_KEY = 'truyen:progress';
export const PROGRESS_LIMIT = 50;

export interface StoryProgress {
  /** Scene index (0-based) to continue from; 0: nothing to continue. */
  index: number;
  /** When it was saved, ms since the epoch. */
  at: number;
}

export type ProgressMap = Record<string, StoryProgress>;

const isProgress = (value: unknown): value is StoryProgress =>
  isRecord(value) && Number.isInteger(value.index) && (value.index as number) >= 0 && typeof value.at === 'number' && Number.isFinite(value.at);

/** The stored map with every malformed entry dropped. */
export function parseProgress(value: unknown): ProgressMap {
  if (!isRecord(value)) return {};
  const map: ProgressMap = {};
  for (const [slug, entry] of Object.entries(value)) if (isProgress(entry)) map[slug] = { index: entry.index, at: entry.at };
  return map;
}

/** Only the PROGRESS_LIMIT most recent stories. */
function newest(map: ProgressMap): ProgressMap {
  return Object.fromEntries(
    Object.entries(map)
      .sort(([, a], [, b]) => b.at - a.at)
      .slice(0, PROGRESS_LIMIT),
  );
}

/** The map after leaving `slug` at scene `index` (scene 0 and below: nothing to continue); only the newest entries stay. */
export function withProgress(map: ProgressMap, slug: string, index: number, at: number): ProgressMap {
  return newest({ ...map, [slug]: { index: Math.max(0, index), at } });
}

/** Both maps in one: per story the later record wins (this device's on a tie); only the newest entries stay. */
export function mergeProgress(local: ProgressMap, remote: ProgressMap): ProgressMap {
  const merged: ProgressMap = { ...local };
  for (const [slug, entry] of Object.entries(remote)) {
    const mine = merged[slug];
    if (!mine || entry.at > mine.at) merged[slug] = entry;
  }
  return newest(merged);
}

/** The scene to continue a story of `sceneCount` scenes from, if there is one. */
export function resumeIndex(entry: StoryProgress | undefined, sceneCount: number): number | null {
  return entry && entry.index > 0 && entry.index < sceneCount ? entry.index : null;
}

/** Tells the components showing progress that it changed in this tab (other tabs get the `storage` event). */
const listeners = new Set<() => void>();

export function readProgress(): ProgressMap {
  return parseProgress(readStored(PROGRESS_KEY));
}

export function writeProgress(map: ProgressMap): void {
  writeStored(PROGRESS_KEY, map);
  for (const listener of [...listeners]) listener();
}

/** The scene to continue `slug` from, if it is valid for a story of `sceneCount` scenes. */
export function progressOf(slug: string, sceneCount: number): number | null {
  return resumeIndex(readProgress()[slug], sceneCount);
}

/** Records where `slug` was left on this device; returns the stored record. */
export function saveProgress(slug: string, index: number, at: number = Date.now()): StoryProgress {
  const map = withProgress(readProgress(), slug, index, at);
  writeProgress(map);
  return map[slug] ?? { index: 0, at };
}

/** A story read to its end: nothing to continue. */
export function forgetProgress(slug: string): StoryProgress {
  return saveProgress(slug, 0);
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  const onStorage = (event: StorageEvent): void => {
    if (event.key === PROGRESS_KEY || event.key === null) listener();
  };
  window.addEventListener('storage', onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener('storage', onStorage);
  };
}

/** Parsed once per stored text, so React gets the same object until the progress really changes. */
let snapshot: { text: string | null; map: ProgressMap } = { text: null, map: {} };
const EMPTY: ProgressMap = {};

function currentProgress(): ProgressMap {
  const text = readStoredText(PROGRESS_KEY);
  if (text !== snapshot.text) snapshot = { text, map: readProgress() };
  return snapshot.map;
}

/** Every story's progress on this device, kept current as the reader saves and as a sync brings other devices' records. */
export function useProgress(): ProgressMap {
  return useSyncExternalStore(subscribe, currentProgress, () => EMPTY);
}

/** `?canh=5` (1-based, as people count scenes) as a scene index, or null when absent or out of range. */
export function sceneFromQuery(search: string, sceneCount: number): number | null {
  const raw = new URLSearchParams(search).get('canh');
  if (raw === null || !/^\d+$/.test(raw)) return null;
  const n = Number(raw);
  return n >= 1 && n <= sceneCount ? n - 1 : null;
}
