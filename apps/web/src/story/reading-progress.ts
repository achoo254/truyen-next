/**
 * Where each story was left (localStorage `truyen:progress`): the scene to continue from and when. A story read to
 * its end is forgotten, so "continue" only offers stories in the middle. Kept for the 50 most recent stories.
 */
import { isRecord, readStored, writeStored } from '../ui/local-store';

export const PROGRESS_KEY = 'truyen:progress';
export const PROGRESS_LIMIT = 50;

export interface StoryProgress {
  /** Scene index (0-based) to continue from. */
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

/** The map after leaving `slug` at scene `index`: scene 0 counts as not started; only the newest entries stay. */
export function withProgress(map: ProgressMap, slug: string, index: number, at: number): ProgressMap {
  const next: ProgressMap = { ...map };
  if (index <= 0) delete next[slug];
  else next[slug] = { index, at };
  const newest = Object.entries(next)
    .sort(([, a], [, b]) => b.at - a.at)
    .slice(0, PROGRESS_LIMIT);
  return Object.fromEntries(newest);
}

export function readProgress(): ProgressMap {
  return parseProgress(readStored(PROGRESS_KEY));
}

/** The scene to continue `slug` from, if it is valid for a story of `sceneCount` scenes. */
export function progressOf(slug: string, sceneCount: number): number | null {
  const entry = readProgress()[slug];
  return entry && entry.index < sceneCount ? entry.index : null;
}

export function saveProgress(slug: string, index: number): void {
  writeStored(PROGRESS_KEY, withProgress(readProgress(), slug, index, Date.now()));
}

export function forgetProgress(slug: string): void {
  writeStored(PROGRESS_KEY, withProgress(readProgress(), slug, 0, Date.now()));
}

/** `?canh=5` (1-based, as people count scenes) as a scene index, or null when absent or out of range. */
export function sceneFromQuery(search: string, sceneCount: number): number | null {
  const raw = new URLSearchParams(search).get('canh');
  if (raw === null || !/^\d+$/.test(raw)) return null;
  const n = Number(raw);
  return n >= 1 && n <= sceneCount ? n - 1 : null;
}
