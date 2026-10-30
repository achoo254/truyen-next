import { useEffect, useRef, useState } from 'react';

export type Load<T> = { status: 'loading' } | { status: 'ready'; value: T } | { status: 'failed'; error: unknown };

/** Runs `load` when `key` changes (and on retry), cancelling the previous request. */
export function useLoad<T>(key: string, load: (signal: AbortSignal) => Promise<T>): [Load<T>, () => void] {
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState<{ key: string; attempt: number; load: Load<T> }>({ key, attempt, load: { status: 'loading' } });
  // A new key or a retry shows "loading" right away instead of the previous result.
  const current: Load<T> = state.key === key && state.attempt === attempt ? state.load : { status: 'loading' };
  // The latest loader, so a new closure each render does not restart the request; only the key and retry do.
  const loadRef = useRef(load);
  useEffect(() => {
    loadRef.current = load;
  }, [load]);

  useEffect(() => {
    const controller = new AbortController();
    loadRef.current(controller.signal).then(
      (value) => setState({ key, attempt, load: { status: 'ready', value } }),
      (error: unknown) => {
        if (!controller.signal.aborted) setState({ key, attempt, load: { status: 'failed', error } });
      },
    );
    return () => controller.abort();
  }, [key, attempt]);

  return [current, () => setAttempt((n) => n + 1)];
}
