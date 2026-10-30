/**
 * The reader's small memories (preferences, where each story was left) in localStorage, as JSON. Storage can be
 * blocked or full (private browsing, settings): reads then give null and writes are skipped with a warning, and
 * the app works as on a first visit. Values are checked by their owners, never trusted.
 */
export function readStored(key: string): unknown {
  try {
    const raw = window.localStorage.getItem(key);
    return raw === null ? null : (JSON.parse(raw) as unknown);
  } catch {
    return null;
  }
}

export function writeStored(key: string, value: unknown): void {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch (error) {
    console.warn(`${key} not saved`, error instanceof Error ? error.name : typeof error);
  }
}

export const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);
