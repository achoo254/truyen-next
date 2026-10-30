import { type ReactNode, useEffect } from 'react';
import { brand } from '../brand';
import { useI18n } from '../i18n/i18n';
import { StoryLoadError, fetchStory } from './story-api';
import { StoryPlayer } from './story-player';
import { useLoad } from './use-load';

export function StoryPage({ slug }: { slug: string }): ReactNode {
  const { t } = useI18n();
  const [load, retry] = useLoad(slug, (signal) => fetchStory(slug, signal));
  const title = load.status === 'ready' ? load.value.title : null;
  useEffect(() => {
    if (title !== null) document.title = `${title} · ${brand.appName}`;
  }, [title]);

  if (load.status === 'loading') {
    return (
      <p className="muted" role="status" data-id="story-loading">
        {t('story.loading')}
      </p>
    );
  }
  if (load.status === 'failed') {
    const notFound = load.error instanceof StoryLoadError && load.error.notFound;
    if (!notFound) console.error('story failed to load', load.error instanceof Error ? load.error.message : load.error);
    return (
      <div className="card" role="alert" data-id="story-load-failed">
        <p>{notFound ? t('story.notFound') : t('page.loadFailed')}</p>
        <div className="row">
          {!notFound && (
            <button type="button" className="btn btn-secondary" onClick={retry}>
              {t('page.reload')}
            </button>
          )}
          <a className="btn btn-ghost" href="/">
            {t('story.back')}
          </a>
        </div>
      </div>
    );
  }
  const story = load.value;
  return (
    <article className="story" data-id="story-page">
      <header className="story-head">
        <a className="back-link" href="/" data-id="story-back">
          {t('story.back')}
        </a>
        <h1 className="story-title" lang="vi">
          {story.title}
        </h1>
        {story.status !== 'text-approved' && (
          <p className="badge" data-id="story-review-note">
            {t('story.reviewNote')}
          </p>
        )}
      </header>
      <StoryPlayer story={story} />
    </article>
  );
}
