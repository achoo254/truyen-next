import { type PointerEvent, useRef } from 'react';

/** A swipe turns the page once it travels this far sideways… */
export const SWIPE_MIN_PX = 48;
/** …or flicks faster than this (px per ms), even when short. */
export const SWIPE_MIN_SPEED = 0.3;
/** A tap within this share of the page's left or right edge turns back or on (when edge taps are on). */
export const EDGE_SHARE = 0.2;
/** Movement under this is a tap, not a swipe. */
export const TAP_MAX_PX = 10;

export type SwipeResult = 'next' | 'prev' | null;

export interface PointerTrace {
  dx: number;
  dy: number;
  ms: number;
  /** Where the pointer went down, as a share of the page's width (0 = left edge). */
  startShare: number;
}

/**
 * What a finished pointer gesture on the page means: a sideways swipe (left = next, right = previous), a tap on an
 * edge (only when `edgeTaps`), or nothing (a vertical scroll, a tap in the middle).
 */
export function readGesture(trace: PointerTrace, edgeTaps: boolean): SwipeResult {
  const { dx, dy, ms, startShare } = trace;
  const sideways = Math.abs(dx) > Math.abs(dy);
  const speed = Math.abs(dx) / Math.max(ms, 1);
  if (sideways && Math.abs(dx) > TAP_MAX_PX && (Math.abs(dx) >= SWIPE_MIN_PX || speed >= SWIPE_MIN_SPEED)) return dx < 0 ? 'next' : 'prev';
  if (edgeTaps && Math.abs(dx) <= TAP_MAX_PX && Math.abs(dy) <= TAP_MAX_PX) {
    if (startShare <= EDGE_SHARE) return 'prev';
    if (startShare >= 1 - EDGE_SHARE) return 'next';
  }
  return null;
}

interface Start {
  x: number;
  y: number;
  t: number;
  share: number;
}

/**
 * Pointer handlers for the book: swipe sideways to turn the page. Buttons and links inside the page keep their
 * own clicks; vertical movement is left to the browser (`touch-action: pan-y` on the element).
 */
export function useSwipe(onTurn: (to: 'next' | 'prev') => void, edgeTaps: boolean): {
  onPointerDown: (event: PointerEvent<HTMLElement>) => void;
  onPointerUp: (event: PointerEvent<HTMLElement>) => void;
  onPointerCancel: () => void;
} {
  const start = useRef<Start | null>(null);
  return {
    onPointerDown(event) {
      if (!event.isPrimary || (event.pointerType === 'mouse' && event.button !== 0)) return;
      if (event.target instanceof Element && event.target.closest('a, button, input, select, textarea')) return;
      const box = event.currentTarget.getBoundingClientRect();
      start.current = { x: event.clientX, y: event.clientY, t: event.timeStamp, share: box.width > 0 ? (event.clientX - box.left) / box.width : 0.5 };
    },
    onPointerUp(event) {
      const from = start.current;
      start.current = null;
      if (!from) return;
      const result = readGesture({ dx: event.clientX - from.x, dy: event.clientY - from.y, ms: event.timeStamp - from.t, startShare: from.share }, edgeTaps);
      if (result) onTurn(result);
    },
    onPointerCancel() {
      start.current = null;
    },
  };
}
