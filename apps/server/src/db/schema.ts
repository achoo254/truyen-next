import { index, integer, pgTable, primaryKey, text, timestamp, uuid } from 'drizzle-orm/pg-core';

/**
 * An account of the hoandat.com IdP that signed in here: its `sub`, and the name, email and picture its userinfo
 * gave at the latest sign-in (scope `openid profile email`), shown in the header's account menu. Each is null when
 * userinfo has none.
 */
export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  sub: text('sub').notNull().unique(),
  name: text('name'),
  email: text('email'),
  picture: text('picture'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull(),
});

/** Web sessions. `id` is the sha256 of the opaque cookie token, never the token itself. */
export const sessions = pgTable(
  'sessions',
  {
    id: text('id').primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull(),
    lastSeenAt: timestamp('last_seen_at', { withTimezone: true }).notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  },
  (table) => [index('sessions_user_id_idx').on(table.userId)],
);

/**
 * "Tủ truyện của tôi": the stories an account saved, by slug. The stories themselves are static files of the site;
 * a slug that is no longer published is kept here and simply not shown.
 */
export const savedStories = pgTable(
  'saved_stories',
  {
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    slug: text('slug').notNull(),
    savedAt: timestamp('saved_at', { withTimezone: true }).notNull(),
  },
  (table) => [primaryKey({ columns: [table.userId, table.slug] }), index('saved_stories_user_id_saved_at_idx').on(table.userId, table.savedAt)],
);

/**
 * Where an account left each story it opened, for "đọc tiếp" on any device and the reading history: the scene to
 * continue from (0 when there is nothing to continue: not past the first scene, or read to the end) and when the
 * browser recorded it. The newer record of a story always wins, whichever device it comes from.
 */
export const readingProgress = pgTable(
  'reading_progress',
  {
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    slug: text('slug').notNull(),
    sceneIndex: integer('scene_index').notNull(),
    readAt: timestamp('read_at', { withTimezone: true }).notNull(),
  },
  (table) => [primaryKey({ columns: [table.userId, table.slug] }), index('reading_progress_user_id_read_at_idx').on(table.userId, table.readAt)],
);
