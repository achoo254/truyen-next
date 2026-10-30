/**
 * How the story maps onto the pages of the turning book (flip-book.tsx). A spread is what the reader sees at rest:
 * one per scene, then the last page. On a phone a spread is one page (picture over text); from 880px it is two
 * pages, picture on the left and text on the right. Pure, so the mapping is pinned by tests.
 */
import type { PlayerState } from './player-state';
import { EDGE_SHARE } from './use-swipe';

export type BookLayout = 'single' | 'spread';
export type Turn = 'next' | 'prev';

/** Every scene, then the last page. */
export function spreadCount(sceneCount: number): number {
  return sceneCount + 1;
}

/** The spread the story is on: its scene, or the last page once it has ended. */
export function storySpread(state: Pick<PlayerState, 'index' | 'sceneCount' | 'status'>): number {
  return state.status === 'ended' ? state.sceneCount : state.index;
}

export function pagesPerSpread(layout: BookLayout): 1 | 2 {
  return layout === 'spread' ? 2 : 1;
}

export function firstPageOf(spread: number, layout: BookLayout): number {
  return spread * pagesPerSpread(layout);
}

export function spreadOfPage(page: number, layout: BookLayout): number {
  return Math.floor(page / pagesPerSpread(layout));
}

/** What the reader did by turning the book from the story's spread to `reached`: one page on or back, or nothing. */
export function turnTo(storyAt: number, reached: number): Turn | null {
  if (reached > storyAt) return 'next';
  if (reached < storyAt) return 'prev';
  return null;
}

/**
 * The spreads that get their content: the ones next to the spread on show and to the one the story is on (a turn
 * shows the page under the leaf, and a jump turns from the page before its goal). The rest stay blank paper.
 */
export function spreadsNear(anchors: readonly number[], count: number): number[] {
  const near = new Set<number>();
  for (const anchor of anchors) {
    for (let spread = anchor - 1; spread <= anchor + 1; spread += 1) if (spread >= 0 && spread < count) near.add(spread);
  }
  return [...near].sort((a, b) => a - b);
}

/** The book's area in its block, as page-flip reports it: two pages wide even when one shows. */
export interface BookRect {
  left: number;
  top: number;
  width: number;
  height: number;
  pageWidth: number;
}

export interface Point {
  x: number;
  y: number;
}

/**
 * page-flip's own "corner" (a click or tap there turns the page; it folds under a hovering mouse): within a fifth of
 * the page diagonal of both a side and the top or bottom of the book. Same sums as the library's isPointOnCorners.
 */
export function inLibraryCorner(point: Point, rect: BookRect): boolean {
  const x = point.x - rect.left;
  const y = point.y - rect.top;
  const reach = Math.hypot(rect.pageWidth, rect.height) / 5;
  const inside = x > 0 && y > 0 && x < rect.width && y < rect.height;
  return inside && (x < reach || x > rect.width - reach) && (y < reach || y > rect.height - reach);
}

/**
 * A tap near the edge of the open book (within EDGE_SHARE of its left or right side) turns back or on. Taps in the
 * library's corners are left to the library, so one tap never turns twice. `point` is in the book block's frame.
 */
export function edgeTap(point: Point, rect: BookRect, layout: BookLayout): Turn | null {
  // In single-page mode the left page of the pair is off screen: the page on show is the right one.
  const start = layout === 'single' ? rect.left + rect.pageWidth : rect.left;
  const span = layout === 'single' ? rect.pageWidth : rect.width;
  if (span <= 0 || point.y < rect.top || point.y > rect.top + rect.height) return null;
  const share = (point.x - start) / span;
  if (share < 0 || share > 1 || inLibraryCorner(point, rect)) return null;
  if (share <= EDGE_SHARE) return 'prev';
  if (share >= 1 - EDGE_SHARE) return 'next';
  return null;
}
