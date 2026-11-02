import type { StoryListEntry } from '@truyen/story';
import type { ReactNode } from 'react';
import { HISTORY_PATH } from '../account/personal-paths';
import { PersonalGate } from '../account/personal-gate';
import { type ReadingEntry, fetchReading } from '../account/reading-api';
import { StoryCover } from '../art/story-cover';
import { type Locale, useI18n } from '../i18n/i18n';
import { resumeIndex } from '../story/reading-progress';
import { fetchStoryList, storyPath } from '../story/story-api';
import { useLoad } from '../story/use-load';
import { LoadFailed, TileSkeleton } from './page-states';

export interface HistoryItem {
  entry: StoryListEntry;
  /** Scene index to continue from, or null when there is nothing to continue. */
  resume: number | null;
  at: number;
}

/** The account's stories that are still published, latest read first, each with where to continue. */
export function historyItems(reading: readonly ReadingEntry[], stories: readonly StoryListEntry[]): HistoryItem[] {
  const bySlug = new Map(stories.map((entry) => [entry.slug, entry]));
  return [...reading]
    .sort((a, b) => b.at - a.at)
    .flatMap((record) => {
      const entry = bySlug.get(record.slug);
      return entry ? [{ entry, resume: resumeIndex(record, entry.scenes), at: record.at }] : [];
    });
}

/** "Đọc tiếp" opens the reader right at the scene (`?canh=`, 1-based as people count scenes). */
export function continueHref(slug: string, resume: number): string {
  return `${storyPath(slug)}?canh=${resume + 1}`;
}

const readDate = (at: number, locale: Locale): string => new Intl.DateTimeFormat(locale === 'vi' ? 'vi-VN' : 'en-GB', { dateStyle: 'medium' }).format(at);

function HistoryList(): ReactNode {
  const { t, locale } = useI18n();
  const [load, retry] = useLoad('history', async (signal) => {
    const [reading, stories] = await Promise.all([fetchReading(signal), fetchStoryList(signal)]);
    return historyItems(reading, stories);
  });
  if (load.status === 'loading') return <TileSkeleton />;
  if (load.status === 'failed') return <LoadFailed error={load.error} retry={retry} />;
  if (load.value.length === 0) {
    return (
      <p className="muted" data-id="history-empty">
        {t('history.empty')}
      </p>
    );
  }
  return (
    <ol className="history-list" aria-label={t('account.history')} data-id="history-list">
      {load.value.map(({ entry, resume, at }) => (
        <li key={entry.slug} className="history-item" data-id={`history-item-${entry.slug}`}>
          <a className="history-link" href={storyPath(entry.slug)} data-id={`history-open-${entry.slug}`}>
            <StoryCover slug={entry.slug} title={entry.title} shelf={entry.shelf} />
            <span className="history-text">
              <span className="history-title" lang="vi">
                {entry.title}
              </span>
              <span className="history-meta">
                {resume === null ? t('history.readOn', { date: readDate(at, locale) }) : t('history.stoppedAt', { n: resume + 1, total: entry.scenes })}
              </span>
            </span>
          </a>
          {resume !== null && (
            <a className="btn btn-primary history-continue" href={continueHref(entry.slug, resume)} data-id={`history-continue-${entry.slug}`}>
              {t('history.continue')}
            </a>
          )}
        </li>
      ))}
    </ol>
  );
}

/** `/lich-su`: every story the signed-in reader opened, on any device, latest first, with "Đọc tiếp". */
export function HistoryPage(): ReactNode {
  const { t } = useI18n();
  return (
    <div className="home personal" data-id="history-page">
      <section className="hero" data-id="history-hero">
        <div className="hero-text">
          <h1 className="hero-title">{t('account.history')}</h1>
          <p className="hero-lede">{t('history.lede')}</p>
        </div>
      </section>
      <PersonalGate path={HISTORY_PATH}>
        <HistoryList />
      </PersonalGate>
    </div>
  );
}
