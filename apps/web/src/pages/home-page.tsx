import { SHELVES, type Shelf, type StoryListEntry, THEMES } from '@truyen/story';
import { type ReactNode, useState } from 'react';
import printUrl from '../art/dong-ho-print.svg';
import { useI18n } from '../i18n/i18n';
import { readProgress } from '../story/reading-progress';
import { fetchStoryList, shelfPath } from '../story/story-api';
import { useLoad } from '../story/use-load';
import { EMPTY_QUERY, applyQuery, queryString } from './library';
import { LoadFailed, TileSkeleton } from './page-states';
import { StoryTile } from './story-tile';

/** How many covers a row on the home page shows before "see all". */
const ROW_SIZE = 12;

/** A titled row of covers that scrolls sideways, with a link to the full shelf view it comes from. */
function TileRow({ title, entries, href, dataId, notes }: { title: string; entries: StoryListEntry[]; href?: string; dataId: string; notes?: Record<string, string> }): ReactNode {
  const { t } = useI18n();
  if (entries.length === 0) return null;
  return (
    <div className="row-block">
      <div className="row-head">
        <h3 className="row-title">{title}</h3>
        {href && (
          <a className="text-link" href={href} data-id={`${dataId}-all`}>
            {t('home.seeAll')}
          </a>
        )}
      </div>
      <ul className="tile-row" aria-label={title} data-id={dataId}>
        {entries.slice(0, ROW_SIZE).map((entry) => (
          <StoryTile key={entry.slug} entry={entry} note={notes?.[entry.slug]} />
        ))}
      </ul>
    </div>
  );
}

/** "Nghe tiếp": stories left in the middle on this device, most recent first. Hidden when there are none. */
function ContinueRow({ entries }: { entries: StoryListEntry[] }): ReactNode {
  const { t } = useI18n();
  const [progress] = useState(readProgress);
  const started = entries
    .filter((entry) => progress[entry.slug] !== undefined)
    .sort((a, b) => (progress[b.slug]?.at ?? 0) - (progress[a.slug]?.at ?? 0));
  const notes = Object.fromEntries(started.map((entry) => [entry.slug, t('home.continueAt', { n: (progress[entry.slug]?.index ?? 0) + 1, total: entry.scenes })]));
  return <TileRow title={t('home.continue')} entries={started} dataId="row-continue" notes={notes} />;
}

/** One shelf on the home page: its newest stories, a bedtime row for children, and its topics as shortcuts. */
function ShelfRows({ shelf, entries }: { shelf: Shelf; entries: StoryListEntry[] }): ReactNode {
  const { t } = useI18n();
  const headingId = `shelf-${shelf}-heading`;
  const newest = applyQuery(entries, EMPTY_QUERY).items;
  const short = applyQuery(entries, { ...EMPTY_QUERY, length: 'ngan', sort: 'ngan' }).items;
  const themes = THEMES.filter((theme) => entries.some((entry) => entry.themes.includes(theme)));
  return (
    <section className={`shelf shelf--${shelf} theme-${shelf}${shelf === 'kids' ? ' shelf--panel' : ''}`} aria-labelledby={headingId} data-id={`shelf-${shelf}`}>
      <div className="shelf-head">
        <h2 className="shelf-title" id={headingId}>
          {t(`shelf.${shelf}`)}
        </h2>
        <a className="text-link" href={shelfPath(shelf)} data-id={`shelf-open-${shelf}`}>
          {t('shelf.only')}
        </a>
      </div>
      {entries.length === 0 ? (
        <p className="muted">{t('shelf.empty')}</p>
      ) : (
        <>
          <TileRow title={t('home.newest')} entries={newest} dataId={`story-list-${shelf}`} />
          {/* Only once the shelf outgrows one row: before that it would repeat the covers just above. */}
          {shelf === 'kids' && short.length > 1 && entries.length > ROW_SIZE / 2 && (
            <TileRow title={t('home.bedtime')} entries={short} href={`${shelfPath(shelf)}${queryString({ ...EMPTY_QUERY, length: 'ngan' })}`} dataId="row-bedtime" />
          )}
          {themes.length > 1 && (
            <nav className="chips topic-links" aria-label={t('library.theme')}>
              {themes.map((theme) => (
                <a key={theme} className="chip" href={`${shelfPath(shelf)}${queryString({ ...EMPTY_QUERY, theme })}`} data-id={`topic-${shelf}-${theme}`}>
                  {t(`theme.${theme}`)}
                </a>
              ))}
            </nav>
          )}
        </>
      )}
    </section>
  );
}

/** `/`: what was left in the middle, then both shelves (children's first) as rows of covers. */
export function HomePage(): ReactNode {
  const { t, locale } = useI18n();
  const [load, retry] = useLoad('stories', (signal) => fetchStoryList(signal));

  let body: ReactNode;
  if (load.status === 'loading') body = <TileSkeleton />;
  else if (load.status === 'failed') body = <LoadFailed error={load.error} retry={retry} />;
  else if (load.value.length === 0) body = <p className="muted">{t('home.empty')}</p>;
  else {
    const stories = load.value;
    body = (
      <>
        <ContinueRow entries={stories} />
        {SHELVES.map((shelf) => (
          <ShelfRows key={shelf} shelf={shelf} entries={stories.filter((entry) => entry.shelf === shelf)} />
        ))}
      </>
    );
  }

  return (
    <div className="home" data-id="home-page">
      <section className="hero" data-id="home-hero">
        <div className="hero-text">
          <h1 className="hero-title">{t('home.title')}</h1>
          <p className="hero-lede">{t('home.lede')}</p>
          {/* Only worth saying to someone reading the site in another language. */}
          {locale !== 'vi' && <p className="hero-lang">{t('story.language')}</p>}
        </div>
        {/* Decoration only: a woodblock print of the mountain, the water and a leaping carp. */}
        <figure className="hero-print" aria-hidden="true">
          <img src={printUrl} width={400} height={500} alt="" decoding="async" />
        </figure>
      </section>
      {body}
    </div>
  );
}
