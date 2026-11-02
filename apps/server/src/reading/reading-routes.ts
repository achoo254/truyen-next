/**
 * Reading progress and history of the signed-in account: GET /api/reading (every story read, newest first) and
 * POST /api/reading (what this browser knows; the newer record of each story wins, and the answer is the merged list
 * the browser then keeps).
 */
import express, { type Router } from 'express';
import { z } from 'zod';
import { requireUserId } from '../auth/require-user';
import type { ServerConfig } from '../config';
import type { Db } from '../db/client';
import { HttpError } from '../http-error';
import { StorySlug } from '../story-slug';
import { listReading, recordReading } from './reading-store';

export interface ReadingRoutesOptions {
  config: ServerConfig;
  db: Db;
  now: () => Date;
}

/** More than a browser keeps (50 stories), so a whole sync fits in one request. */
export const MAX_ENTRIES_PER_REQUEST = 100;

const ReadingBody = z.strictObject({
  entries: z
    .array(
      z.strictObject({
        slug: StorySlug,
        /** Scene index; no story comes near a thousand scenes. */
        index: z.number().int().min(0).max(999),
        /** ms since the epoch, as Date.now() gives it. */
        at: z.number().int().min(0).max(8_640_000_000_000_000),
      }),
    )
    .max(MAX_ENTRIES_PER_REQUEST),
});

export function readingRoutes({ config, db, now }: ReadingRoutesOptions): Router {
  const router = express.Router();

  router.get('/api/reading', async (req, res) => {
    const userId = await requireUserId(req, config, db, now());
    res.set('Cache-Control', 'no-store').json({ entries: await listReading(db, userId) });
  });

  router.post('/api/reading', async (req, res) => {
    const at = now();
    const userId = await requireUserId(req, config, db, at);
    const body = ReadingBody.safeParse(req.body);
    if (!body.success) throw new HttpError(400, 'invalid-reading');
    res.set('Cache-Control', 'no-store').json({ entries: await recordReading(db, userId, body.data.entries, at) });
  });

  return router;
}
