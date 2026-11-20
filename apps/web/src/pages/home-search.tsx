import type { StoryListEntry } from '@truyen/story';
import { type ReactNode, useEffect, useId, useMemo, useState } from 'react';
import { useI18n } from '../i18n/i18n';
import { EMPTY_QUERY, PAGE_SIZE, applyQuery, parseQuery, queryString } from './library';
import { SEARCH_DEBOUNCE_MS, SearchField } from './search-field';
import { StoryTile } from './story-tile';

/**
 * The search box at the top of the home page, over every shelf at once. With nothing typed it shows `children` (the
 * rows of the home page); with a search it shows the matching covers of all shelves instead, each tagged with its
 * shelf. The search lives in the address (`/?q=`) like a shelf's does, so reload, Back and a shared link keep it.
 */
export function HomeSearch({ entries, children }: { entries: readonly StoryListEntry[]; children: ReactNode }): ReactNode {
  const { t } = useI18n();
  const searchId = useId();
  const [q, setQ] = useState(() => parseQuery(window.location.search).q);
  const [typed, setTyped] = useState(q);
  const [pages, setPages] = useState(1);

  useEffect(() => {
    if (typed === q) return undefined;
    const id = window.setTimeout(() => {
      setQ(typed);
      setPages(1);
    }, SEARCH_DEBOUNCE_MS);
    return () => window.clearTimeout(id);
  }, [typed, q]);
  // The URL follows the search (replace, not push: Back leaves the page instead of undoing each keystroke).
  useEffect(() => {
    const url = `${window.location.pathname}${queryString({ ...EMPTY_QUERY, q })}`;
    if (url !== `${window.location.pathname}${window.location.search}`) window.history.replaceState(null, '', url);
  }, [q]);

  const searching = q.trim() !== '';
  const view = useMemo(() => applyQuery(entries, { ...EMPTY_QUERY, q, pages }), [entries, q, pages]);
  const clear = (): void => {
    setTyped('');
    setQ('');
  };

  return (
    <>
      <div className="shelf-tools" role="search" data-id="home-search-tools">
        <div className="search-bar">
          <SearchField id={searchId} value={typed} onChange={setTyped} dataId="home-search" />
        </div>
      </div>
      {!searching ? (
        children
      ) : (
        <section className="shelf" aria-label={t('library.search')} data-id="home-search-results">
          <p className="shelf-count" role="status" data-id="home-search-count">
            {t('library.count', { n: view.total })}
            <button type="button" className="text-button" onClick={clear} data-id="home-search-clear">
              {t('library.clear')}
            </button>
          </p>
          {view.total === 0 ? (
            <div className="shelf-empty" data-id="home-search-empty">
              <p>{t('home.searchNone', { q: q.trim() })}</p>
            </div>
          ) : (
            <ul className="tile-grid" aria-label={t('library.search')} data-id="story-list-search">
              {view.items.map((entry) => (
                <StoryTile key={entry.slug} entry={entry} query={q} note={t(`shelf.${entry.shelf}`)} />
              ))}
            </ul>
          )}
          {view.hasMore && (
            <button type="button" className="btn btn-secondary more-btn" onClick={() => setPages((n) => n + 1)} data-id="home-search-more">
              {t('library.more', { n: Math.min(PAGE_SIZE, view.total - view.items.length) })}
            </button>
          )}
        </section>
      )}
    </>
  );
}
