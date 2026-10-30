import { useEffect, useRef, useState } from 'react';

/** How often the timer moves the subtitles on. */
export const TICK_MS = 200;

/**
 * Time spent on a scene that has no recorded voice: counts while `running`, keeps its place while paused, and
 * calls `onEnd` once when `durationMs` is reached. The scene component is keyed per scene run, so a new scene
 * starts a new timer at zero.
 */
export function useSceneTimer(durationMs: number, running: boolean, onEnd: () => void): number {
  const [elapsed, setElapsed] = useState(0);
  const elapsedRef = useRef(0);
  const endedRef = useRef(false);
  const onEndRef = useRef(onEnd);
  useEffect(() => {
    onEndRef.current = onEnd;
  }, [onEnd]);

  useEffect(() => {
    if (!running || endedRef.current) return undefined;
    let last = Date.now();
    const id = window.setInterval(() => {
      const now = Date.now();
      elapsedRef.current = Math.min(durationMs, elapsedRef.current + (now - last));
      last = now;
      setElapsed(elapsedRef.current);
      if (elapsedRef.current >= durationMs && !endedRef.current) {
        endedRef.current = true;
        window.clearInterval(id);
        onEndRef.current();
      }
    }, TICK_MS);
    return () => window.clearInterval(id);
  }, [running, durationMs]);

  return elapsed;
}
