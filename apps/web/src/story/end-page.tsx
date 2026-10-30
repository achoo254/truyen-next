import type { Story, StoryListEntry } from '@truyen/story';
import type { ReactNode } from 'react';
import { useI18n } from '../i18n/i18n';
import { Icon } from '../ui/icons';
import { fetchStoryList, shelfPath, storyPath } from './story-api';
import { useLoad } from './use-load';

/** How many stories the last page suggests. */
export const NEXT_COUNT = 2;

/**
 * The stories to suggest after `slug`: the ones that follow it on the same shelf, wrapping round to the start.
 * Nothing plays by itself; the reader (or the parent of the child) picks.
 */
export function nextStories(list: readonly StoryListEntry[], story: Pick<Story, 'slug' | 'shelf'>, count = NEXT_COUNT): StoryListEntry[] {
  const shelf = list.filter((entry) => entry.shelf === story.shelf);
  const at = shelf.findIndex((entry) => entry.slug === story.slug);
  const after = at < 0 ? shelf : [...shelf.slice(at + 1), ...shelf.slice(0, at)];
  return after.slice(0, count);
}

function NextStories({ story }: { story: Story }): ReactNode {
  const { t } = useI18n();
  const [load] = useLoad('stories', (signal) => fetchStoryList(signal));
  // While loading or when the list fails, the page still has "play again" and "back to the shelf".
  if (load.status !== 'ready') return null;
  const next = nextStories(load.value, story);
  if (next.length === 0) return null;
  return (
    <nav className="end-next" aria-label={t('story.nextStories')}>
      <h3 className="end-next-title">{t('story.nextStories')}</h3>
      <ul className="end-next-list">
        {next.map((entry) => (
          <li key={entry.slug}>
            <a className="end-next-link" href={storyPath(entry.slug)} data-id={`story-next-${entry.slug}`}>
              <span className="end-next-name" lang="vi">
                {entry.title}
              </span>
              <span className="end-next-length">{t('home.minutes', { minutes: entry.minutes })}</span>
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}

interface EndPageProps {
  story: Story;
  onReplay: () => void;
  /** A still copy on a turning leaf: no list fetch, nothing to press. */
  copy?: boolean;
}

/**
 * The last spread: "Hết" carved in a woodblock frame (Mèo Miu waves goodbye on the children's shelf), then play
 * again, two stories to go on with, and the way back to the shelf. Never starts another story by itself.
 */
export function EndPage({ story, onReplay, copy = false }: EndPageProps): ReactNode {
  const { t } = useI18n();
  const shelf = t(`shelf.${story.shelf}`);
  return (
    <div className="spread spread--end" data-id={copy ? undefined : 'story-ended'}>
      <div className="page page--end-mark">
        <div className="end-mark">
          <p className="end-mark-word">{t('story.endWord')}</p>
          <p className="end-mark-line" role={copy ? undefined : 'status'}>
            {t(`story.ended.${story.shelf}`)}
          </p>
        </div>
      </div>
      <div className="page page--end-actions">
        <h2 className="end-title" lang="vi">
          {story.title}
        </h2>
        <button type="button" className="btn btn-primary end-replay" onClick={onReplay} data-id={copy ? undefined : 'story-replay'}>
          <Icon name="replay" />
          {t('story.replay')}
        </button>
        {!copy && <NextStories story={story} />}
        <a className="end-shelf" href={shelfPath(story.shelf)} data-id={copy ? undefined : 'story-end-shelf'}>
          {t('story.backToShelf', { shelf })}
        </a>
      </div>
    </div>
  );
}
