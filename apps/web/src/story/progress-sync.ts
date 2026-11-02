/**
 * "Đọc tiếp trên mọi máy": while an account is signed in, this device's progress (story/reading-progress.ts) and the
 * account's on the server are merged, the newer record of each story winning on both sides.
 *
 * - Once per page view, as soon as the page knows the account is signed in, every local record goes up and the
 *   server's answer (the account's whole list) is merged back into localStorage; the story page then shows the right
 *   "Đọc tiếp từ cảnh N" even when the story was read on another device.
 * - While reading, each record is saved locally at once and sent a moment later, grouped (a scene turn, a pause and a
 *   resume in a row make one request); a page being closed sends what is waiting with `keepalive`.
 *
 * A failed request only logs: the local record stays newer than the server's, so the next sync sends it again. A guest
 * never talks to the server.
 */
import { type ReadingEntry, entriesOf, mapOf, sendReading } from '../account/reading-api';
import { isSignedIn, sessionStore } from '../account/session';
import { mergeProgress, readProgress, saveProgress, writeProgress } from './reading-progress';

/** How long records wait before going up together. */
export const SEND_DELAY_MS = 2000;

let waiting = new Map<string, ReadingEntry>();
let timer: ReturnType<typeof setTimeout> | null = null;

/** Takes the server's list into this device's progress. */
function keep(remote: readonly ReadingEntry[]): void {
  writeProgress(mergeProgress(readProgress(), mapOf(remote)));
}

function warn(what: string, error: unknown): void {
  console.warn(what, error instanceof Error ? error.message : typeof error);
}

/** Sends the waiting records now. */
export function flushProgress(keepalive = false): Promise<void> {
  if (timer !== null) {
    clearTimeout(timer);
    timer = null;
  }
  if (waiting.size === 0 || !isSignedIn()) return Promise.resolve();
  const entries = [...waiting.values()];
  waiting = new Map();
  return sendReading(entries, keepalive).then(keep, (error: unknown) => warn('progress not sent', error));
}

/** Where the reader left `slug` (0: nothing to continue): saved on this device, and for an account also on the server. */
export function recordProgress(slug: string, index: number): void {
  const entry = saveProgress(slug, index);
  if (!isSignedIn()) return;
  waiting.set(slug, { slug, ...entry });
  timer ??= setTimeout(() => void flushProgress(), SEND_DELAY_MS);
}

/** Sends every local record and keeps the merged answer (an account only). */
export async function syncProgress(): Promise<void> {
  if (!isSignedIn()) return;
  try {
    keep(await sendReading(entriesOf(readProgress())));
  } catch (error) {
    warn('progress not synced', error);
  }
}

/**
 * Starts the sync for this page view: once the session says "signed in", one full sync; and a flush when the page is
 * hidden or closed. Returns the stop function.
 */
export function startProgressSync(): () => void {
  let synced = false;
  const onSession = (): void => {
    if (synced || !isSignedIn()) return;
    synced = true;
    void syncProgress();
  };
  const onHide = (): void => {
    if (document.visibilityState === 'hidden') void flushProgress(true);
  };
  const stop = sessionStore.subscribe(onSession);
  onSession();
  document.addEventListener('visibilitychange', onHide);
  window.addEventListener('pagehide', onHide);
  return () => {
    stop();
    document.removeEventListener('visibilitychange', onHide);
    window.removeEventListener('pagehide', onHide);
  };
}
