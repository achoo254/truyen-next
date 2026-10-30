import { type Shelf, type StoryListEntry, THEMES, type Theme } from '@truyen/story';
import { type ReactNode, useEffect, useId, useMemo, useState } from 'react';
import { MeoMiu } from '../art/meo-miu';
import { useI18n } from '../i18n/i18n';
import { fetchStoryList } from '../story/story-api';
import { useLoad } from '../story/use-load';
import { Icon } from '../ui/icons';
import { EMPTY_QUERY, LENGTHS, type LengthBand, PAGE_SIZE, SORTS, type ShelfQuery, type SortOrder, applyQuery, parseQuery, queryString } from './library';
import { LoadFailed, TileSkeleton } from './page-states';
import { StoryTile } from './story-tile';

/** Typing settles for this long before the shelf filters (and the URL follows). */
const SEARCH_DEBOUNCE_MS = 120;

/** A row of chips where at most one is on; pressing the one that is on turns it off. */
function ChipRow<T extends string>({ label, options, value, onChange, name, dataId }: {
  label: string;
  options: readonly T[];
  value: T | null;
  onChange: (value: T | null) => void;
  name: (option: T) => string;
  dataId: string;
}): ReactNode {
  const labelId = useId();
  return (
    <div className="chip-row" role="group" aria-labelledby={labelId}>
      <span className="chip-row-label" id={labelId}>
        {label}
      </span>
      <div className="chips">
        {options.map((option) => (
          <button key={option} type="button" className="chip" aria-pressed={option === value} onClick={() => onChange(option === value ? null : option)} data-id={`${dataId}-${option}`}>
            {name(option)}
          </button>
        ))}
      </div>
    </div>
  );
}

function ShelfBrowser({ shelf, entries }: { shelf: Shelf; entries: StoryListEntry[] }): ReactNode {
  const { t } = useI18n();
  const [query, setQuery] = useState<ShelfQuery>(() => parseQuery(window.location.search));
  const [typed, setTyped] = useState(query.q);
  const searchId = useId();

  // The URL follows the state (replace, not push: Back leaves the shelf instead of undoing each keystroke).
  useEffect(() => {
    const url = `${window.location.pathname}${queryString(query)}`;
    if (url !== `${window.location.pathname}${window.location.search}`) window.history.replaceState(null, '', url);
  }, [query]);
  useEffect(() => {
    if (typed === query.q) return undefined;
    const id = window.setTimeout(() => setQuery((current) => ({ ...current, q: typed, pages: 1 })), SEARCH_DEBOUNCE_MS);
    return () => window.clearTimeout(id);
  }, [typed, query.q]);

  const view = useMemo(() => applyQuery(entries, query), [entries, query]);
  const shelfThemes = useMemo(() => THEMES.filter((theme) => entries.some((entry) => entry.themes.includes(theme))), [entries]);
  const change = (next: Partial<ShelfQuery>): void => setQuery((current) => ({ ...current, ...next, pages: 1 }));
  const filtered = query.q.trim() !== '' || query.theme !== null || query.length !== null;
  const clear = (): void => {
    setTyped('');
    setQuery(EMPTY_QUERY);
  };

  return (
    <section className={`shelf shelf--${shelf} theme-${shelf}`} aria-labelledby={`${searchId}-heading`} data-id={`shelf-${shelf}`}>
      <h2 className="sr-only" id={`${searchId}-heading`}>
        {t(`shelf.${shelf}`)}
      </h2>
      <div className="shelf-tools" role="search" data-id="shelf-tools">
        <label className="search" htmlFor={searchId}>
          <Icon name="search" />
          <span className="sr-only">{t('library.search')}</span>
          <input
            id={searchId}
            className="search-input"
            type="search"
            value={typed}
            placeholder={t('library.searchHint')}
            autoComplete="off"
            enterKeyHint="search"
            onChange={(event) => setTyped(event.currentTarget.value)}
            data-id="shelf-search"
          />
        </label>
        <ChipRow<LengthBand> label={t('library.length')} options={LENGTHS} value={query.length} onChange={(length) => change({ length })} name={(band) => t(`library.length.${band}`)} dataId="filter-length" />
        {shelfThemes.length > 1 && (
          <ChipRow<Theme> label={t('library.theme')} options={shelfThemes} value={query.theme} onChange={(theme) => change({ theme })} name={(theme) => t(`theme.${theme}`)} dataId="filter-theme" />
        )}
        <ChipRow<SortOrder>
          label={t('library.sort')}
          options={SORTS}
          value={query.sort}
          onChange={(sort) => change({ sort: sort ?? 'moi' })}
          name={(sort) => t(`library.sort.${sort}`)}
          dataId="sort"
        />
      </div>
      <p className="shelf-count" role="status" data-id="shelf-count">
        {t('library.count', { n: view.total })}
        {filtered && (
          <button type="button" className="text-button" onClick={clear} data-id="shelf-clear">
            {t('library.clear')}
          </button>
        )}
      </p>
      {view.total === 0 ? (
        <div className="shelf-empty" data-id="shelf-empty">
          <p>{entries.length === 0 ? t('shelf.empty') : t('library.none', { q: query.q.trim() || '…' })}</p>
          {entries.length > 0 && shelfThemes.length > 0 && (
            <div className="chips">
              {shelfThemes.map((theme) => (
                <button key={theme} type="button" className="chip" onClick={() => setQuery({ ...EMPTY_QUERY, theme })}>
                  {t(`theme.${theme}`)}
                </button>
              ))}
            </div>
          )}
        </div>
      ) : (
        <ul className="tile-grid" aria-label={t(`shelf.${shelf}`)} data-id={`story-list-${shelf}`}>
          {view.items.map((entry) => (
            <StoryTile key={entry.slug} entry={entry} query={query.q} />
          ))}
        </ul>
      )}
      {view.hasMore && (
        <button type="button" className="btn btn-secondary more-btn" onClick={() => setQuery((current) => ({ ...current, pages: current.pages + 1 }))} data-id="shelf-more">
          {t('library.more', { n: Math.min(PAGE_SIZE, view.total - view.items.length) })}
        </button>
      )}
    </section>
  );
}

/** `/tre-em`, `/nguoi-lon`: one shelf, searchable and filterable, as a grid of covers. */
export function ShelfPage({ shelf }: { shelf: Shelf }): ReactNode {
  const { t, locale } = useI18n();
  const [load, retry] = useLoad('stories', (signal) => fetchStoryList(signal));
  let body: ReactNode;
  if (load.status === 'loading') body = <TileSkeleton />;
  else if (load.status === 'failed') body = <LoadFailed error={load.error} retry={retry} />;
  else body = <ShelfBrowser shelf={shelf} entries={load.value.filter((entry) => entry.shelf === shelf)} />;

  return (
    <div className="home" data-id={`shelf-page-${shelf}`}>
      <section className={`hero hero--${shelf}`} data-id="home-hero">
        <div className="hero-text">
          <h1 className="hero-title">{t(`shelf.${shelf}.title`)}</h1>
          <p className="hero-lede">{t(`shelf.${shelf}.lede`)}</p>
          {locale !== 'vi' && <p className="hero-lang">{t('story.language')}</p>}
          <a className="text-link" href="/" data-id="shelf-all">
            {t('shelf.all')}
          </a>
        </div>
        {shelf === 'kids' && (
          <figure className="hero-miu" data-id="hero-miu">
            <MeoMiu />
            <figcaption className="hero-miu-says">{t('shelf.kids.miuSays')}</figcaption>
          </figure>
        )}
      </section>
      {body}
    </div>
  );
}
