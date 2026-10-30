import { SHELVES, type Shelf, type StoryListEntry } from '@truyen/story';
import type { ReactNode } from 'react';
import printUrl from '../art/dong-ho-print.svg';
import { useI18n } from '../i18n/i18n';
import { fetchStoryList, shelfPath, storyPath } from '../story/story-api';
import { useLoad } from '../story/use-load';

/** One shelf: its heading, and its stories as cards. On the home page the heading links to the shelf's own page. */
function ShelfSection({ shelf, stories, linkToShelf }: { shelf: Shelf; stories: StoryListEntry[]; linkToShelf: boolean }): ReactNode {
  const { t } = useI18n();
  const headingId = `shelf-${shelf}-heading`;
  return (
    <section className={`shelf shelf--${shelf} theme-${shelf}`} aria-labelledby={headingId} data-id={`shelf-${shelf}`}>
      <div className="shelf-head">
        <h2 className="shelf-title" id={headingId}>
          {t(`shelf.${shelf}`)}
        </h2>
        {linkToShelf && (
          <a className="pill" href={shelfPath(shelf)} data-id={`shelf-open-${shelf}`}>
            {t('shelf.only')}
          </a>
        )}
      </div>
      {stories.length === 0 ? (
        <p className="muted">{t('shelf.empty')}</p>
      ) : (
        <ul className="story-list" aria-labelledby={headingId} data-id={`story-list-${shelf}`}>
          {stories.map((entry) => (
            <li key={entry.slug} className="card story-card" data-id={`story-card-${entry.slug}`}>
              <h3 className="story-card-title" lang="vi">
                {entry.title}
              </h3>
              <p className="story-card-length">{t('home.length', { minutes: entry.minutes, scenes: entry.scenes })}</p>
              <p className="story-card-summary" lang="vi">
                {entry.summary}
              </p>
              <a className="btn btn-primary" href={storyPath(entry.slug)} data-id={`story-open-${entry.slug}`}>
                {t('home.open')}
              </a>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/**
 * `/`: both shelves, children's first. `/tre-em`, `/nguoi-lon` (`shelf` set): that shelf only, with a link to all
 * stories.
 */
export function HomePage({ shelf }: { shelf?: Shelf }): ReactNode {
  const { t, locale } = useI18n();
  const [load, retry] = useLoad('stories', (signal) => fetchStoryList(signal));
  const shelves = shelf ? [shelf] : SHELVES;

  let body: ReactNode;
  if (load.status === 'loading') {
    body = (
      <p className="muted" role="status">
        {t('home.loading')}
      </p>
    );
  } else if (load.status === 'failed') {
    console.error('story list failed to load', load.error instanceof Error ? load.error.message : load.error);
    body = (
      <p className="card" role="alert" data-id="home-load-failed">
        {t('page.loadFailed')}{' '}
        <button type="button" className="btn btn-secondary" onClick={retry}>
          {t('page.reload')}
        </button>
      </p>
    );
  } else if (!shelf && load.value.length === 0) {
    body = <p className="muted">{t('home.empty')}</p>;
  } else {
    const stories = load.value;
    body = shelves.map((each) => (
      <ShelfSection key={each} shelf={each} stories={stories.filter((entry) => entry.shelf === each)} linkToShelf={!shelf} />
    ));
  }

  return (
    <div className="home" data-id={shelf ? `shelf-page-${shelf}` : 'home-page'}>
      <section className="hero" data-id="home-hero">
        <div className="hero-text">
          <h1 className="hero-title">{shelf ? t(`shelf.${shelf}.title`) : t('home.title')}</h1>
          <p className="hero-lede">{shelf ? t(`shelf.${shelf}.lede`) : t('home.lede')}</p>
          {/* Only worth saying to someone reading the site in another language. */}
          {locale !== 'vi' && <p className="hero-lang">{t('story.language')}</p>}
          {shelf && (
            <a className="pill" href="/" data-id="shelf-all">
              {t('shelf.all')}
            </a>
          )}
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
