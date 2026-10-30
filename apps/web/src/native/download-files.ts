/** What downloading a story for offline listening fetches and how its progress and size read; no Capacitor here. */
import { type Story, storyMediaFiles } from '@truyen/story';

/** The story itself, written next to its media once they are all on the phone. */
export const STORY_JSON = 'story.json';

/** The files to fetch for a story kept on the phone: every media file story.json refers to, once each. */
export function storyMediaDownloads(story: Story): string[] {
  return [...new Set(storyMediaFiles(story))];
}

export interface DownloadProgress {
  filesDone: number;
  files: number;
  /** Bytes fetched so far. */
  bytes: number;
  /** All bytes, when the site told every file's size; null otherwise. */
  total: number | null;
}

/** How far a download is (0–1): by bytes when the sizes are known, else by files. */
export function downloadShare(progress: DownloadProgress): number {
  const share = progress.total !== null && progress.total > 0 ? progress.bytes / progress.total : progress.files > 0 ? progress.filesDone / progress.files : 0;
  return Math.min(1, Math.max(0, share));
}

/** A size as people read it: "820 KB", "12 MB", "1,2 GB" (Vietnamese decimal comma). */
export function formatBytes(bytes: number, locale: 'vi' | 'en'): string {
  const units = ['B', 'KB', 'MB', 'GB'];
  let value = Math.max(0, bytes);
  let unit = 0;
  while (value >= 1000 && unit < units.length - 1) {
    value /= 1000;
    unit += 1;
  }
  const digits = value < 10 && unit > 0 ? 1 : 0;
  return `${new Intl.NumberFormat(locale === 'vi' ? 'vi-VN' : 'en-US', { maximumFractionDigits: digits }).format(value)} ${units[unit]}`;
}

/** A Content-Length header value as a byte count, or null when missing or not a number. */
export function contentLength(headers: Record<string, string> | undefined): number | null {
  if (!headers) return null;
  const entry = Object.entries(headers).find(([name]) => name.toLowerCase() === 'content-length');
  const value = entry ? Number(entry[1]) : Number.NaN;
  return Number.isInteger(value) && value >= 0 ? value : null;
}
