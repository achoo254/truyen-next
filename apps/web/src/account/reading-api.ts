/** The signed-in account's reading progress and history on the server (apps/server reading-routes.ts). */
import type { ProgressMap } from '../story/reading-progress';
import { isRecord } from '../ui/local-store';
import { apiJson } from './api-client';

/** One story as the server keeps it: the scene to continue from (0: nothing to continue) and when, ms since the epoch. */
export interface ReadingEntry {
  slug: string;
  index: number;
  at: number;
}

const isEntry = (value: unknown): value is ReadingEntry =>
  isRecord(value) &&
  typeof value.slug === 'string' &&
  Number.isInteger(value.index) &&
  (value.index as number) >= 0 &&
  typeof value.at === 'number' &&
  Number.isFinite(value.at);

/** The entries of an answer, newest first as the server sends them; anything malformed is dropped. */
export function parseEntries(body: unknown): ReadingEntry[] {
  if (!isRecord(body) || !Array.isArray(body.entries)) throw new Error('reading answer not understood');
  return body.entries.filter(isEntry).map(({ slug, index, at }) => ({ slug, index, at }));
}

export function entriesOf(map: ProgressMap): ReadingEntry[] {
  return Object.entries(map).map(([slug, { index, at }]) => ({ slug, index, at }));
}

export function mapOf(entries: readonly ReadingEntry[]): ProgressMap {
  return Object.fromEntries(entries.map(({ slug, index, at }) => [slug, { index, at }]));
}

/** The account's stories, most recently read first. */
export async function fetchReading(signal?: AbortSignal): Promise<ReadingEntry[]> {
  return parseEntries(await apiJson('/api/reading', { signal }));
}

/**
 * Sends what this browser knows; the server keeps the newer record of each story and answers with the account's whole
 * list. `keepalive` lets the request finish while the page is closing.
 */
export async function sendReading(entries: readonly ReadingEntry[], keepalive = false): Promise<ReadingEntry[]> {
  return parseEntries(await apiJson('/api/reading', { method: 'POST', body: JSON.stringify({ entries }), keepalive }));
}
