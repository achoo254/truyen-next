import { type Story, storyListEntry } from '@truyen/story';
import { type ReactNode, type RefObject, Suspense, lazy, useCallback, useEffect, useRef, useState } from 'react';
import { IN_APP } from '../platform/app-build';
import { StoryCover } from '../art/story-cover';
import { useI18n } from '../i18n/i18n';
import { setPageMeta } from '../page-meta';
import { Icon } from '../ui/icons';
import { StoryLoadError, fetchStory, shelfPath } from './story-api';
import { progressOf, sceneFromQuery } from './reading-progress';
import { storyHasVoice } from './scene-media';
import { StoryPlayer } from './story-player';
import { useLoad } from './use-load';

/** The download row (iPhone app only): loaded on its own, so the web never fetches the app's code. */
const DownloadPanel = IN_APP ? lazy(() => import('../native/download-ui').then((module) => ({ default: module.DownloadPanel }))) : null;

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
function StoryCoverPage({ story, onOpen, openRef }: { story: Story; onOpen: (index: number) => void; openRef: RefObject<HTMLButtonElement | null> }): ReactNode {
  const { t } = useI18n();
  const shelf = t(`shelf.${story.shelf}`);
  const { minutes, scenes } = storyListEntry(story);
  // Read once per visit to the page: the reader saves as it goes, and closing it comes back here.
  const [resume] = useState(() => progressOf(story.slug, story.scenes.length));
  // Until a story has its voice it is read, not heard, so the buttons say so.
  const voiced = storyHasVoice(story);
  return (
    <article className={`story theme-${story.shelf}`} data-id="story-page">
      <a className="back-link" href={shelfPath(story.shelf)} data-id="story-back">
        <Icon name="back" />
        {t('story.backToShelf', { shelf })}
      </a>
      <div className="story-intro">
        <StoryCover slug={story.slug} title={story.title} shelf={story.shelf} size="large" />
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
          <p className="story-based-on" data-id="story-based-on">
            {t('story.basedOn', { source: story.basedOn })}
          </p>
          <div className="story-actions">
            <button ref={openRef} type="button" className="btn btn-primary btn-large" onClick={() => onOpen(resume ?? 0)} data-id="story-open-reader">
              <Icon name="play" />
              {resume === null ? t(voiced ? 'story.listen' : 'story.read') : t(voiced ? 'story.resumeFrom' : 'story.readFrom', { n: resume + 1 })}
            </button>
            {resume !== null && (
              <button type="button" className="btn btn-secondary btn-large" onClick={() => onOpen(0)} data-id="story-from-start">
                {t(voiced ? 'story.fromStart' : 'story.readFromStart')}
              </button>
            )}
          </div>
          {DownloadPanel && (
            <Suspense fallback={null}>
              <DownloadPanel story={story} />
            </Suspense>
          )}
        </div>
      </div>
    </article>
  );
}

export function StoryPage({ slug }: { slug: string }): ReactNode {
  const { t } = useI18n();
  const [load, retry] = useLoad(slug, (signal) => fetchStory(slug, signal));
  const loaded = load.status === 'ready' ? load.value : null;
  // null: the story's page; a number: the reader, open at that scene. A shared ?canh= link opens the reader.
  const [reading, setReading] = useState<number | null>(null);
  const [linked, setLinked] = useState(true);
  const openRef = useRef<HTMLButtonElement>(null);
  const linkedScene = linked && loaded ? sceneFromQuery(window.location.search, loaded.scenes.length) : null;
  const openAt = reading ?? linkedScene;
  useReadingMode(openAt !== null);
  useEffect(() => {
    if (loaded) setPageMeta(loaded.title, loaded.summary);
  }, [loaded]);
  const close = useCallback(() => {
    setReading(null);
    setLinked(false);
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
  if (openAt !== null) return <StoryPlayer story={story} initialIndex={openAt} onClose={close} />;
  return <StoryCoverPage key={story.slug} story={story} onOpen={setReading} openRef={openRef} />;
}
