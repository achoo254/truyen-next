import { z } from 'zod';

/**
 * A story's slug as the site names it (`/truyen/<slug>`, `stories/<slug>/`): lowercase words joined by single
 * dashes. The server does not know which stories are published (they are static files); it only keeps well-formed
 * slugs of a sane length.
 */
export const StorySlug = z
  .string()
  .max(100)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);
