/** How the reader likes to read, kept between visits (localStorage `truyen:prefs:v1`). */
import { useCallback, useState } from 'react';
import { isRecord, readStored, writeStored } from '../ui/local-store';

export const PREFS_KEY = 'truyen:prefs:v1';
export const TEXT_SIZES = ['s', 'm', 'l'] as const;
export type TextSize = (typeof TEXT_SIZES)[number];
export const RATES = [0.75, 1, 1.25] as const;
export type Rate = (typeof RATES)[number];

export interface ReaderPrefs {
  /** Turn to the next scene when one ends; off: the book waits on the last line until the reader turns. */
  autoTurn: boolean;
  textSize: TextSize;
  /** Voice speed, and the pace of the scene clock while a story has no voice. */
  rate: Rate;
  /** Subtitles show unless turned off, which is only offered when the story has a voice. */
  subtitles: boolean;
}

export const DEFAULT_PREFS: ReaderPrefs = { autoTurn: true, textSize: 'm', rate: 1, subtitles: true };

const oneOf = <T,>(options: readonly T[], value: unknown, fallback: T): T => (options.includes(value as T) ? (value as T) : fallback);

/** Whatever was stored, as valid preferences: unknown or broken fields fall back to the defaults. */
export function parsePrefs(value: unknown): ReaderPrefs {
  if (!isRecord(value)) return { ...DEFAULT_PREFS };
  return {
    autoTurn: typeof value.autoTurn === 'boolean' ? value.autoTurn : DEFAULT_PREFS.autoTurn,
    textSize: oneOf(TEXT_SIZES, value.textSize, DEFAULT_PREFS.textSize),
    rate: oneOf(RATES, value.rate, DEFAULT_PREFS.rate),
    subtitles: typeof value.subtitles === 'boolean' ? value.subtitles : DEFAULT_PREFS.subtitles,
  };
}

export function useReaderPrefs(): [ReaderPrefs, (change: Partial<ReaderPrefs>) => void] {
  const [prefs, setPrefs] = useState(() => parsePrefs(readStored(PREFS_KEY)));
  const update = useCallback((change: Partial<ReaderPrefs>) => {
    setPrefs((current) => {
      const next = { ...current, ...change };
      writeStored(PREFS_KEY, next);
      return next;
    });
  }, []);
  return [prefs, update];
}
