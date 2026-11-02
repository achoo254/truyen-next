import { and, desc, eq, notInArray, sql } from 'drizzle-orm';
import type { Db } from '../db/client';
import { readingProgress } from '../db/schema';

/** Stories kept per account (the reading history): the oldest beyond this go. */
export const HISTORY_LIMIT = 200;

/** Where a story was left: the scene to continue from (0: nothing to continue) and when, in ms since the epoch. */
export interface ReadingEntry {
  slug: string;
  index: number;
  at: number;
}

/** The account's stories, most recently read first. */
export async function listReading(db: Db, userId: string): Promise<ReadingEntry[]> {
  const rows = await db
    .select({ slug: readingProgress.slug, index: readingProgress.sceneIndex, readAt: readingProgress.readAt })
    .from(readingProgress)
    .where(eq(readingProgress.userId, userId))
    .orderBy(desc(readingProgress.readAt), readingProgress.slug);
  return rows.map((row) => ({ slug: row.slug, index: row.index, at: row.readAt.getTime() }));
}

/**
 * Per story, the newer of two records; on a tie the incoming one. A clock running ahead cannot pin a story for
 * ever: a time later than `now` counts as `now`.
 */
export function newestPerSlug(entries: readonly ReadingEntry[], now: Date): ReadingEntry[] {
  const newest = new Map<string, ReadingEntry>();
  for (const entry of entries) {
    const at = Math.min(entry.at, now.getTime());
    const kept = newest.get(entry.slug);
    if (!kept || at >= kept.at) newest.set(entry.slug, { slug: entry.slug, index: entry.index, at });
  }
  return [...newest.values()];
}

/**
 * Records what a browser knows, keeping per story whichever record is newer (the browser's or the stored one), then
 * drops the oldest stories beyond HISTORY_LIMIT. Returns the account's stories after the merge.
 */
export async function recordReading(db: Db, userId: string, entries: readonly ReadingEntry[], now: Date): Promise<ReadingEntry[]> {
  const incoming = newestPerSlug(entries, now);
  await db.transaction(async (tx) => {
    if (incoming.length > 0) {
      await tx
        .insert(readingProgress)
        .values(incoming.map((entry) => ({ userId, slug: entry.slug, sceneIndex: entry.index, readAt: new Date(entry.at) })))
        .onConflictDoUpdate({
          target: [readingProgress.userId, readingProgress.slug],
          set: { sceneIndex: sql`excluded.scene_index`, readAt: sql`excluded.read_at` },
          setWhere: sql`${readingProgress.readAt} <= excluded.read_at`,
        });
    }
    const keep = tx
      .select({ slug: readingProgress.slug })
      .from(readingProgress)
      .where(eq(readingProgress.userId, userId))
      .orderBy(desc(readingProgress.readAt), readingProgress.slug)
      .limit(HISTORY_LIMIT);
    await tx.delete(readingProgress).where(and(eq(readingProgress.userId, userId), notInArray(readingProgress.slug, keep)));
  });
  return listReading(db, userId);
}
