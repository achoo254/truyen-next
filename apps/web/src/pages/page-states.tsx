import { type ReactNode, useEffect } from 'react';
import { useI18n } from '../i18n/i18n';

/** Covers still loading: cover-shaped blocks in the grid's own layout, so nothing jumps when they arrive. */
export function TileSkeleton(): ReactNode {
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

/** The story list did not load: say so, log why, offer to try again. */
export function LoadFailed({ error, retry }: { error: unknown; retry: () => void }): ReactNode {
  const { t } = useI18n();
  useEffect(() => {
    console.error('story list failed to load', error instanceof Error ? error.message : error);
  }, [error]);
  return (
    <div className="card notice" role="alert" data-id="home-load-failed">
      <p>{t('page.loadFailed')}</p>
      <button type="button" className="btn btn-secondary" onClick={retry}>
        {t('page.reload')}
      </button>
    </div>
  );
}
