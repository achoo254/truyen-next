import type { ReactNode } from 'react';
import { useI18n } from '../i18n/i18n';
import { fetchStoryList, storyPath } from '../story/story-api';
import { useLoad } from '../story/use-load';

export function HomePage(): ReactNode {
  const { t } = useI18n();
  const [load, retry] = useLoad('stories', (signal) => fetchStoryList(signal));

  let list: ReactNode;
  if (load.status === 'loading') {
    list = (
      <p className="muted" role="status">
        {t('home.loading')}
      </p>
    );
  } else if (load.status === 'failed') {
    console.error('story list failed to load', load.error instanceof Error ? load.error.message : load.error);
    list = (
      <p className="card" role="alert" data-id="home-load-failed">
        {t('page.loadFailed')}{' '}
        <button type="button" className="btn btn-secondary" onClick={retry}>
          {t('page.reload')}
        </button>
      </p>
    );
  } else if (load.value.length === 0) {
    list = <p className="muted">{t('home.empty')}</p>;
  } else {
    list = (
      <ul className="story-list" aria-label={t('home.listLabel')} data-id="story-list">
        {load.value.map((entry) => (
          <li key={entry.slug} className="card story-card" data-id={`story-card-${entry.slug}`}>
            <h2 className="story-card-title" lang="vi">
              {entry.title}
            </h2>
            <p className="muted">{t('home.length', { minutes: entry.minutes, scenes: entry.scenes })}</p>
            <p className="story-card-summary" lang="vi">
              {entry.summary}
            </p>
            <a className="btn btn-primary" href={storyPath(entry.slug)} data-id={`story-open-${entry.slug}`}>
              {t('home.open')}
            </a>
          </li>
        ))}
      </ul>
    );
  }

  return (
    <div className="home" data-id="home-page">
      <section className="hero">
        <h1 className="hero-title">{t('home.title')}</h1>
        <p className="hero-lede">{t('home.lede')}</p>
        <p className="muted">{t('story.language')}</p>
      </section>
      {list}
    </div>
  );
}
