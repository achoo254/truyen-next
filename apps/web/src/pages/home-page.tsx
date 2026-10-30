import { SHELVES, type Shelf, type StoryListEntry } from '@truyen/story';
import type { ReactNode } from 'react';
import { MeoMiu } from '../art/meo-miu';
import printUrl from '../art/dong-ho-print.svg';
import { useI18n } from '../i18n/i18n';
import { fetchStoryList, shelfPath } from '../story/story-api';
import { useLoad } from '../story/use-load';
import { StoryTile } from './story-tile';

/** One shelf: its heading, and its stories as a grid of covers. On the home page the heading links to the shelf's own page. */
function ShelfSection({ shelf, stories, linkToShelf }: { shelf: Shelf; stories: StoryListEntry[]; linkToShelf: boolean }): ReactNode {
  const { t } = useI18n();
  const headingId = `shelf-${shelf}-heading`;
  return (
    <section className={`shelf shelf--${shelf} theme-${shelf}${linkToShelf && shelf === 'kids' ? ' shelf--panel' : ''}`} aria-labelledby={headingId} data-id={`shelf-${shelf}`}>
      <div className="shelf-head">
        <h2 className="shelf-title" id={headingId}>
          {t(`shelf.${shelf}`)}
        </h2>
        {linkToShelf && (
          <a className="text-link" href={shelfPath(shelf)} data-id={`shelf-open-${shelf}`}>
            {t('shelf.only')}
          </a>
        )}
      </div>
      {stories.length === 0 ? (
        <p className="muted">{t('shelf.empty')}</p>
      ) : (
        <ul className="tile-grid" aria-labelledby={headingId} data-id={`story-list-${shelf}`}>
          {stories.map((entry) => (
            <StoryTile key={entry.slug} entry={entry} />
          ))}
        </ul>
      )}
    </section>
  );
}

/** Covers still loading: grey cover shapes in the grid's own layout, so nothing jumps when they arrive. */
function ShelfSkeleton(): ReactNode {
  const { t } = useI18n();
  return (
    <div className="tile-grid tile-grid--skeleton" role="status" data-id="home-loading">
      <span className="sr-only">{t('home.loading')}</span>
      {[0, 1, 2, 3, 4].map((n) => (
        <span key={n} className="tile-skeleton" aria-hidden="true" />
      ))}
    </div>
  );
}

/** The picture beside the title: the carp print on the home page, Mèo Miu on the children's shelf. */
function HeroArt({ shelf }: { shelf?: Shelf }): ReactNode {
  const { t } = useI18n();
  if (shelf === 'kids') {
    return (
      <figure className="hero-miu" data-id="hero-miu">
        <MeoMiu />
        <figcaption className="hero-miu-says">{t('shelf.kids.miuSays')}</figcaption>
      </figure>
    );
  }
  if (shelf === 'adults') return null;
  // Decoration only: a woodblock print of the mountain, the water and a leaping carp.
  return (
    <figure className="hero-print" aria-hidden="true">
      <img src={printUrl} width={400} height={500} alt="" decoding="async" />
    </figure>
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
    body = <ShelfSkeleton />;
  } else if (load.status === 'failed') {
    console.error('story list failed to load', load.error instanceof Error ? load.error.message : load.error);
    body = (
      <div className="card notice" role="alert" data-id="home-load-failed">
        <p>{t('page.loadFailed')}</p>
        <button type="button" className="btn btn-secondary" onClick={retry}>
          {t('page.reload')}
        </button>
      </div>
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
      <section className={`hero${shelf ? ` hero--${shelf}` : ''}`} data-id="home-hero">
        <div className="hero-text">
          <h1 className="hero-title">{shelf ? t(`shelf.${shelf}.title`) : t('home.title')}</h1>
          <p className="hero-lede">{shelf ? t(`shelf.${shelf}.lede`) : t('home.lede')}</p>
          {/* Only worth saying to someone reading the site in another language. */}
          {locale !== 'vi' && <p className="hero-lang">{t('story.language')}</p>}
          {shelf && (
            <a className="text-link" href="/" data-id="shelf-all">
              {t('shelf.all')}
            </a>
          )}
        </div>
        <HeroArt shelf={shelf} />
      </section>
      {body}
    </div>
  );
}
