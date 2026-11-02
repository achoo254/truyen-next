/**
 * "Tủ truyện của tôi" of the signed-in account: GET /api/shelf (the saved stories), PUT /api/shelf/:slug (save),
 * DELETE /api/shelf/:slug (take off). PUT and DELETE are idempotent.
 */
import express, { type Request, type Router } from 'express';
import { requireUserId } from '../auth/require-user';
import type { ServerConfig } from '../config';
import type { Db } from '../db/client';
import { HttpError } from '../http-error';
import { StorySlug } from '../story-slug';
import { listSaved, removeStory, saveStory } from './shelf-store';

export interface ShelfRoutesOptions {
  config: ServerConfig;
  db: Db;
  now: () => Date;
}

function slugOf(req: Request): string {
  const slug = StorySlug.safeParse(req.params.slug);
  if (!slug.success) throw new HttpError(400, 'invalid-slug');
  return slug.data;
}

export function shelfRoutes({ config, db, now }: ShelfRoutesOptions): Router {
  const router = express.Router();
  const userIdOf = (req: Request): Promise<string> => requireUserId(req, config, db, now());

  router.get('/api/shelf', async (req, res) => {
    const userId = await userIdOf(req);
    res.set('Cache-Control', 'no-store').json({ stories: await listSaved(db, userId) });
  });

  router.put('/api/shelf/:slug', async (req, res) => {
    const userId = await userIdOf(req);
    if ((await saveStory(db, userId, slugOf(req), now())) === 'limit') throw new HttpError(409, 'shelf-full');
    res.status(204).end();
  });

  router.delete('/api/shelf/:slug', async (req, res) => {
    const userId = await userIdOf(req);
    await removeStory(db, userId, slugOf(req));
    res.status(204).end();
  });

  return router;
}
