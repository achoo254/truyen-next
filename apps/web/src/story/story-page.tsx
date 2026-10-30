import { type Story, storyListEntry } from '@truyen/story';
import { type ReactNode, type RefObject, useCallback, useEffect, useRef, useState } from 'react';
import { useI18n } from '../i18n/i18n';
import { setPageMeta } from '../page-meta';
import { Icon } from '../ui/icons';
import { StoryLoadError, fetchStory, shelfPath } from './story-api';
import { StoryPlayer } from './story-player';
import { useLoad } from './use-load';

/** While the reader is open the site's header and footer step aside (html.reading in app.css) and the page does not scroll. */
function useReadingMode(reading: boolean): void {
  useEffect(() => {
    if (!reading) return undefined;
    const root = document.documentElement;
    root.classList.add('reading');
    window.scrollTo(0, 0);
    return () => root.classList.remove('reading');
  }, [reading]);
}

/** The story's own page: its cover, title, summary and length, and the button that opens the reader. */
function StoryCoverPage({ story, onOpen, openRef }: { story: Story; onOpen: () => void; openRef: RefObject<HTMLButtonElement | null> }): ReactNode {
  const { t } = useI18n();
  const shelf = t(`shelf.${story.shelf}`);
  const { minutes, scenes } = storyListEntry(story);
  return (
    <article className={`story theme-${story.shelf}`} data-id="story-page">
      <a className="back-link" href={shelfPath(story.shelf)} data-id="story-back">
        <Icon name="back" />
        {t('story.backToShelf', { shelf })}
      </a>
      <div className="story-intro">
        <div className="story-intro-text">
          <p className="seal story-shelf" data-id="story-shelf" data-shelf={story.shelf}>
            {t('shelf.label', { shelf })}
          </p>
          <h1 className="story-title" lang="vi">
            {story.title}
          </h1>
          <p className="story-length">{t('story.length', { minutes, scenes })}</p>
          <p className="story-summary" lang="vi">
            {story.summary}
          </p>
          <div className="story-actions">
            <button ref={openRef} type="button" className="btn btn-primary btn-large" onClick={onOpen} data-id="story-open-reader">
              <Icon name="play" />
              {t('story.listen')}
            </button>
          </div>
        </div>
      </div>
    </article>
  );
}

export function StoryPage({ slug }: { slug: string }): ReactNode {
  const { t } = useI18n();
  const [load, retry] = useLoad(slug, (signal) => fetchStory(slug, signal));
  const loaded = load.status === 'ready' ? load.value : null;
  const [reading, setReading] = useState(false);
  const openRef = useRef<HTMLButtonElement>(null);
  useReadingMode(reading);
  useEffect(() => {
    if (loaded) setPageMeta(loaded.title, loaded.summary);
  }, [loaded]);
  const close = useCallback(() => {
    setReading(false);
    // Back on the story page, the focus returns to the button that opened the reader.
    window.requestAnimationFrame(() => openRef.current?.focus());
  }, []);

  if (load.status === 'loading') {
    return (
      <div className="story-skeleton" role="status" data-id="story-loading">
        <span className="sr-only">{t('story.loading')}</span>
      </div>
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
  if (reading) return <StoryPlayer story={story} onClose={close} />;
  return <StoryCoverPage story={story} onOpen={() => setReading(true)} openRef={openRef} />;
}
