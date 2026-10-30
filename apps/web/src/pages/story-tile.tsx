import type { StoryListEntry } from '@truyen/story';
import type { ReactNode } from 'react';
import { StoryCover } from '../art/story-cover';
import { useI18n } from '../i18n/i18n';
import { storyPath } from '../story/story-api';
import { highlight } from './library';

/** The title with the searched words in <mark>. */
function MarkedTitle({ title, query }: { title: string; query: string }): ReactNode {
  return highlight(title, query).map((segment, i) => (segment.hit ? <mark key={i}>{segment.text}</mark> : <span key={i}>{segment.text}</span>));
}

/** A story on a shelf: its cover (title in the cartouche) and how long it takes, the whole tile one link. */
export function StoryTile({ entry, note, query = '' }: { entry: StoryListEntry; note?: string; query?: string }): ReactNode {
  const { t } = useI18n();
  return (
    <li className="tile" data-id={`story-card-${entry.slug}`}>
      <a className="tile-link" href={storyPath(entry.slug)} data-id={`story-open-${entry.slug}`}>
        <StoryCover slug={entry.slug} title={entry.title} shelf={entry.shelf} titleContent={query.trim() ? <MarkedTitle title={entry.title} query={query} /> : undefined} />
        <span className="tile-meta">
          <span className="tile-length">{t('home.minutes', { minutes: entry.minutes })}</span>
          {note && <span className="tile-note">{note}</span>}
        </span>
      </a>
    </li>
  );
}
