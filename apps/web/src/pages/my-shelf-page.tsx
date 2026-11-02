import type { StoryListEntry } from '@truyen/story';
import { type ReactNode, useEffect } from 'react';
import { PersonalGate } from '../account/personal-gate';
import { MY_SHELF_PATH } from '../account/personal-paths';
import { loadShelf, useShelf } from '../account/shelf-store';
import { useI18n } from '../i18n/i18n';
import { fetchStoryList } from '../story/story-api';
import { useLoad } from '../story/use-load';
import { LoadFailed, TileSkeleton } from './page-states';
import { StoryTile } from './story-tile';

/** The saved stories that are still published, in the shelf's order (latest saved first). */
export function savedEntries(slugs: readonly string[], stories: readonly StoryListEntry[]): StoryListEntry[] {
  const bySlug = new Map(stories.map((entry) => [entry.slug, entry]));
  return slugs.flatMap((slug) => bySlug.get(slug) ?? []);
}

function SavedStories(): ReactNode {
  const { t } = useI18n();
  const shelf = useShelf();
  const [stories, retryStories] = useLoad('stories', (signal) => fetchStoryList(signal));
  useEffect(() => loadShelf(), []);

  if (shelf.status === 'failed') return <LoadFailed error={new Error('shelf not loaded')} retry={() => loadShelf(true)} />;
  if (stories.status === 'failed') return <LoadFailed error={stories.error} retry={retryStories} />;
  if (shelf.status !== 'ready' || stories.status !== 'ready') return <TileSkeleton />;
  const entries = savedEntries(shelf.slugs, stories.value);
  if (entries.length === 0) {
    return (
      <p className="muted" data-id="my-shelf-empty">
        {t('myShelf.empty')}
      </p>
    );
  }
  return (
    <ul className="tile-grid" aria-label={t('account.myShelf')} data-id="my-shelf-list">
      {entries.map((entry) => (
        <StoryTile key={entry.slug} entry={entry} />
      ))}
    </ul>
  );
}

/** `/tu-truyen`: "Tủ truyện của tôi", the stories the signed-in reader saved. */
export function MyShelfPage(): ReactNode {
  const { t } = useI18n();
  return (
    <div className="home personal" data-id="my-shelf-page">
      <section className="hero" data-id="my-shelf-hero">
        <div className="hero-text">
          <h1 className="hero-title">{t('account.myShelf')}</h1>
          <p className="hero-lede">{t('myShelf.lede')}</p>
        </div>
      </section>
      <PersonalGate path={MY_SHELF_PATH}>
        <SavedStories />
      </PersonalGate>
    </div>
  );
}
