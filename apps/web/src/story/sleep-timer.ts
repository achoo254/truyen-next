/**
 * The sleep timer: stop the story after a number of minutes, or at its end. When it runs out, the reader fades the
 * sound and the page for SLEEP_FADE_MS, then pauses.
 */
export const SLEEP_OPTIONS = ['off', 'end', 10, 20, 30] as const;
export type SleepOption = (typeof SLEEP_OPTIONS)[number];
export const SLEEP_FADE_MS = 10_000;

/** When a timer picked at `now` runs out (ms since the epoch); null for off and for "at the end of the story". */
export function sleepDeadline(option: SleepOption, now: number): number | null {
  return typeof option === 'number' ? now + option * 60_000 : null;
}

/** Whole minutes left, rounded up, never below zero. */
export function minutesLeft(deadline: number, now: number): number {
  return Math.max(0, Math.ceil((deadline - now) / 60_000));
}

/** The volume share while fading: 1 at the start of the fade, 0 at its end. */
export function fadeShare(fadeStart: number, now: number): number {
  return Math.min(1, Math.max(0, 1 - (now - fadeStart) / SLEEP_FADE_MS));
}
