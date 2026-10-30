import { type ReactNode, useEffect } from 'react';
import { useI18n } from './i18n/i18n';
import { SitePage } from './layout/site-page';
import { HomePage } from './pages/home-page';
import { ShelfPage } from './pages/shelf-page';
import { setPageMeta } from './page-meta';
import { type LegalPageKind, LegalPage, legalTitle } from './pages/legal-pages';
import { parseShelfPath, parseStoryPath } from './story/story-api';
import { StoryPage } from './story/story-page';

const LEGAL_PATHS: Record<string, LegalPageKind> = { '/privacy': 'privacy', '/terms': 'terms', '/credits': 'credits' };

/** Normalised path: no trailing slash except the root. */
export function routePath(pathname: string): string {
  return pathname.length > 1 ? pathname.replace(/\/+$/, '') : pathname;
}

function NotFound(): ReactNode {
  const { t } = useI18n();
  return (
    <article className="card doc" data-id="not-found">
      <h1 className="doc-title">{t('notFound.title')}</h1>
      <a className="btn btn-primary" href="/">
        {t('notFound.back')}
      </a>
    </article>
  );
}

/** The page for the current path inside the shared frame. */
export function App({ pathname }: { pathname: string }): ReactNode {
  const { t, locale } = useI18n();
  const path = routePath(pathname);
  const legal = LEGAL_PATHS[path];
  const slug = parseStoryPath(path);
  const shelf = parseShelfPath(path);

  useEffect(() => {
    // A story page sets its own title once the story has loaded.
    if (slug) return;
    let page: string;
    let description = t('home.description');
    if (path === '/') page = t('home.title');
    else if (shelf) {
      page = t(`shelf.${shelf}.title`);
      description = t(`shelf.${shelf}.description`);
    } else if (legal) page = legalTitle(legal, locale);
    else page = t('notFound.title');
    setPageMeta(page, description);
  }, [path, legal, slug, shelf, locale, t]);

  let page: ReactNode;
  if (path === '/') page = <HomePage />;
  else if (shelf) page = <ShelfPage shelf={shelf} />;
  else if (legal) page = <LegalPage kind={legal} />;
  else if (slug) page = <StoryPage slug={slug} />;
  else page = <NotFound />;

  return <SitePage path={path}>{page}</SitePage>;
}
