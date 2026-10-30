/**
 * Offline listening in the iPhone app: the download row on a story's page (size, progress, remove) and the page of
 * downloaded stories with the space they take. Loaded only by the app build (story-page.tsx, app.tsx).
 */
import type { Story } from '@truyen/story';
import { type ReactNode, useCallback, useEffect, useRef, useState } from 'react';
import { StoryCover } from '../art/story-cover';
import { useI18n } from '../i18n/i18n';
import { storyPath } from '../story/story-api';
import { Icon } from '../ui/icons';
import { type DownloadProgress, downloadShare, formatBytes } from './download-files';
import { type Download, DownloadCancelled, downloadOf, downloadStory, measureStory, removeDownload, restoreDownloads } from './downloads';

type PanelState =
  | { kind: 'checking' }
  | { kind: 'absent'; size: number | null }
  | { kind: 'downloading'; progress: DownloadProgress }
  | { kind: 'saved'; download: Download }
  | { kind: 'failed' };

/** The download row of a story's page. */
export function DownloadPanel({ story }: { story: Story }): ReactNode {
  const { t, locale } = useI18n();
  const [state, setState] = useState<PanelState>({ kind: 'checking' });
  const cancel = useRef<AbortController | null>(null);

  useEffect(() => {
    let live = true;
    void (async () => {
      const saved = await downloadOf(story.slug);
      if (!live) return;
      if (saved) {
        setState({ kind: 'saved', download: saved });
        return;
      }
      setState({ kind: 'absent', size: null });
      const size = await measureStory(story).catch(() => null);
      if (live) setState((current) => (current.kind === 'absent' ? { kind: 'absent', size } : current));
    })().catch((error: unknown) => {
      console.warn('download state unknown', error instanceof Error ? error.message : error);
      if (live) setState({ kind: 'absent', size: null });
    });
    return () => {
      live = false;
      cancel.current?.abort();
    };
  }, [story]);

  const start = useCallback(async () => {
    const controller = new AbortController();
    cancel.current = controller;
    try {
      const download = await downloadStory(story, (progress) => setState({ kind: 'downloading', progress }), controller.signal);
      setState({ kind: 'saved', download });
    } catch (error) {
      if (error instanceof DownloadCancelled) {
        setState({ kind: 'absent', size: null });
        return;
      }
      console.error('download failed', error instanceof Error ? error.message : error);
      setState({ kind: 'failed' });
    }
  }, [story]);

  const remove = useCallback(async () => {
    try {
      await removeDownload(story.slug);
      setState({ kind: 'absent', size: null });
    } catch (error) {
      console.error('could not remove the download', error instanceof Error ? error.message : error);
      setState({ kind: 'failed' });
    }
  }, [story.slug]);

  if (state.kind === 'checking') return null;
  return (
    <div className="download" data-id="story-download" data-state={state.kind}>
      {state.kind === 'downloading' ? (
        <>
          <p className="download-note" role="status">
            {t('download.progress', { percent: Math.round(downloadShare(state.progress) * 100) })}
          </p>
          <div className="download-bar" aria-hidden="true">
            <span className="download-bar-fill" style={{ transform: `scaleX(${downloadShare(state.progress)})` }} />
          </div>
          <button type="button" className="btn btn-ghost" onClick={() => cancel.current?.abort()} data-id="download-cancel">
            {t('download.cancel')}
          </button>
        </>
      ) : state.kind === 'saved' ? (
        <>
          <p className="download-note" data-id="download-saved">
            <Icon name="check" />
            {t('download.saved', { size: formatBytes(state.download.bytes, locale) })}
          </p>
          <button type="button" className="btn btn-ghost" onClick={() => void remove()} data-id="download-remove">
            {t('download.remove')}
          </button>
        </>
      ) : (
        <>
          <button type="button" className="btn btn-secondary" onClick={() => void start()} data-id="download-start">
            <Icon name="download" />
            {t('download.save')}
            {state.kind === 'absent' && state.size !== null && <span className="download-size"> ({t('download.size', { size: formatBytes(state.size, locale) })})</span>}
          </button>
          {state.kind === 'failed' && (
            <p className="download-note" role="alert">
              {t('download.failed')}
            </p>
          )}
        </>
      )}
    </div>
  );
}

/** `/da-tai`: the stories on the phone, the space they take, and a way to remove each. */
export function DownloadsPage(): ReactNode {
  const { t, locale } = useI18n();
  const [downloads, setDownloads] = useState<Download[] | null>(null);
  const [failed, setFailed] = useState(false);
  const reload = useCallback(() => {
    restoreDownloads().then(setDownloads, (error: unknown) => {
      console.error('downloads unreadable', error instanceof Error ? error.message : error);
      setFailed(true);
    });
  }, []);
  useEffect(reload, [reload]);

  const remove = async (slug: string): Promise<void> => {
    try {
      await removeDownload(slug);
    } catch (error) {
      console.error('could not remove the download', error instanceof Error ? error.message : error);
    }
    reload();
  };

  const total = downloads?.reduce((sum, download) => sum + download.bytes, 0) ?? 0;
  return (
    <article className="card doc downloads" data-id="downloads-page">
      <h1 className="doc-title">{t('download.title')}</h1>
      <p>{t('download.lede')}</p>
      {failed && (
        <p role="alert" data-id="downloads-failed">
          {t('page.loadFailed')}
        </p>
      )}
      {downloads !== null && downloads.length === 0 && <p data-id="downloads-empty">{t('download.empty')}</p>}
      {downloads !== null && downloads.length > 0 && (
        <>
          <p className="download-note" data-id="downloads-total">
            {t('download.total', { size: formatBytes(total, locale) })}
          </p>
          <ul className="downloads-list">
            {downloads.map((download) => (
              <li key={download.slug} className="downloads-item" data-id={`download-${download.slug}`}>
                <a className="downloads-link" href={storyPath(download.slug)}>
                  <StoryCover slug={download.slug} title={download.title} shelf={download.shelf} size="mini" />
                  <span className="downloads-text">
                    <span className="downloads-name" lang="vi">
                      {download.title}
                    </span>
                    <span className="downloads-size">{formatBytes(download.bytes, locale)}</span>
                  </span>
                </a>
                <button type="button" className="btn btn-ghost" onClick={() => void remove(download.slug)} data-id={`download-remove-${download.slug}`}>
                  {t('download.remove')}
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
    </article>
  );
}
