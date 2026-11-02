/**
 * "Tủ truyện của tôi" of the signed-in account (apps/server shelf-routes.ts): the slugs of the saved stories, most
 * recently saved first, loaded once per page view and shared by the save button and the shelf page. Saving and taking
 * off show at once and are put back if the server refuses.
 */
import { createStore, useStoreValue } from '../ui/external-store';
import { isRecord } from '../ui/local-store';
import { apiFetch, apiJson } from './api-client';

export type ShelfState = { status: 'idle' } | { status: 'loading' } | { status: 'failed' } | { status: 'ready'; slugs: readonly string[] };

export const shelfStore = createStore<ShelfState>({ status: 'idle' });

/** The slugs of an answer of GET /api/shelf. */
export function parseShelf(body: unknown): string[] {
  if (!isRecord(body) || !Array.isArray(body.stories)) throw new Error('shelf answer not understood');
  return body.stories.flatMap((story) => (isRecord(story) && typeof story.slug === 'string' ? [story.slug] : []));
}

/** Loads the shelf unless it is loaded or on its way; `retry` also after a failure. */
export function loadShelf(retry = false): void {
  const { status } = shelfStore.get();
  if (status === 'loading' || status === 'ready' || (status === 'failed' && !retry)) return;
  shelfStore.set({ status: 'loading' });
  apiJson('/api/shelf').then(
    (body) => shelfStore.set({ status: 'ready', slugs: parseShelf(body) }),
    (error: unknown) => {
      console.warn('shelf not loaded', error instanceof Error ? error.message : typeof error);
      shelfStore.set({ status: 'failed' });
    },
  );
}

export function useShelf(): ShelfState {
  return useStoreValue(shelfStore);
}

function withSlug(slugs: readonly string[], slug: string, saved: boolean): string[] {
  const rest = slugs.filter((s) => s !== slug);
  return saved ? [slug, ...rest] : rest;
}

/** Saves `slug` or takes it off the shelf; shows it at once, puts it back and throws when the server refuses. */
export async function setSaved(slug: string, saved: boolean): Promise<void> {
  const before = shelfStore.get();
  if (before.status === 'ready') shelfStore.set({ status: 'ready', slugs: withSlug(before.slugs, slug, saved) });
  try {
    await apiFetch(`/api/shelf/${encodeURIComponent(slug)}`, { method: saved ? 'PUT' : 'DELETE' });
  } catch (error) {
    const now = shelfStore.get();
    if (now.status === 'ready') shelfStore.set({ status: 'ready', slugs: withSlug(now.slugs, slug, !saved) });
    throw error;
  }
}
