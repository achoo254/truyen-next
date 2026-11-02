import { and, desc, eq, sql } from 'drizzle-orm';
import type { Db } from '../db/client';
import { savedStories, users } from '../db/schema';

/** Saved stories per account: more than the whole catalogue, so only a runaway client ever meets it. */
export const MAX_SAVED_PER_USER = 2000;

export interface SavedStory {
  slug: string;
  savedAt: string;
}

/** The account's saved stories, most recently saved first. */
export async function listSaved(db: Db, userId: string): Promise<SavedStory[]> {
  const rows = await db
    .select({ slug: savedStories.slug, savedAt: savedStories.savedAt })
    .from(savedStories)
    .where(eq(savedStories.userId, userId))
    .orderBy(desc(savedStories.savedAt), savedStories.slug);
  return rows.map((row) => ({ slug: row.slug, savedAt: row.savedAt.toISOString() }));
}

/** Saves a story (saving it again keeps the first time); 'limit' when the account is full. */
export async function saveStory(db: Db, userId: string, slug: string, now: Date): Promise<'saved' | 'limit'> {
  return db.transaction(async (tx) => {
    // Lock the account row so two saves at once cannot both pass the count.
    await tx.select({ id: users.id }).from(users).where(eq(users.id, userId)).for('update');
    const [already] = await tx
      .select({ slug: savedStories.slug })
      .from(savedStories)
      .where(and(eq(savedStories.userId, userId), eq(savedStories.slug, slug)));
    if (already) return 'saved';
    const [counted] = await tx.select({ n: sql<number>`count(*)::int` }).from(savedStories).where(eq(savedStories.userId, userId));
    if ((counted?.n ?? 0) >= MAX_SAVED_PER_USER) return 'limit';
    await tx.insert(savedStories).values({ userId, slug, savedAt: now });
    return 'saved';
  });
}

/** Takes a story off the account's shelf; nothing happens when it was not there. */
export async function removeStory(db: Db, userId: string, slug: string): Promise<void> {
  await db.delete(savedStories).where(and(eq(savedStories.userId, userId), eq(savedStories.slug, slug)));
}
