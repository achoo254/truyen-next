import { describe, expect, it } from 'vitest';
import { type BookRect, edgeTap, firstPageOf, inLibraryCorner, spreadCount, spreadOfPage, spreadsNear, storySpread, turnTo } from './book-pages';

describe('the story as spreads and pages', () => {
  it('has one spread per scene and the last page after them', () => {
    expect(spreadCount(8)).toBe(9);
    expect(storySpread({ index: 3, sceneCount: 8, status: 'playing' })).toBe(3);
    expect(storySpread({ index: 7, sceneCount: 8, status: 'ended' })).toBe(8);
  });

  it('puts a spread on one page on phones and on two pages from 880px', () => {
    expect(firstPageOf(3, 'single')).toBe(3);
    expect(firstPageOf(3, 'spread')).toBe(6);
    expect(spreadOfPage(3, 'single')).toBe(3);
    expect(spreadOfPage(6, 'spread')).toBe(3);
    expect(spreadOfPage(7, 'spread')).toBe(3);
  });

  it('reads a turn made on the book against the spread the story is on', () => {
    expect(turnTo(3, 4)).toBe('next');
    expect(turnTo(3, 2)).toBe('prev');
    // The book arriving where the story already is (a turn the story asked for) changes nothing.
    expect(turnTo(3, 3)).toBeNull();
  });

  it('fills only the spreads next to the one on show and the one the story is on', () => {
    expect(spreadsNear([0], 9)).toEqual([0, 1]);
    expect(spreadsNear([4, 4], 9)).toEqual([3, 4, 5]);
    expect(spreadsNear([1, 6], 9)).toEqual([0, 1, 2, 5, 6, 7]);
    expect(spreadsNear([8], 9)).toEqual([7, 8]);
  });
});

describe('taps on the book', () => {
  // Two 400×600 pages side by side, 20px in from the block's corner.
  const spread: BookRect = { left: 20, top: 20, width: 800, height: 600, pageWidth: 400 };
  // One 300×500 page: the library keeps an unseen left page off to the left of it.
  const single: BookRect = { left: -300, top: 0, width: 600, height: 500, pageWidth: 300 };

  it('knows the library corners, a fifth of the page diagonal from the top or bottom corners', () => {
    expect(inLibraryCorner({ x: 30, y: 30 }, spread)).toBe(true);
    expect(inLibraryCorner({ x: 810, y: 610 }, spread)).toBe(true);
    expect(inLibraryCorner({ x: 30, y: 320 }, spread)).toBe(false);
    expect(inLibraryCorner({ x: 420, y: 30 }, spread)).toBe(false);
    expect(inLibraryCorner({ x: 5, y: 5 }, spread)).toBe(false);
  });

  it('turns on a tap near the left or right edge of the open spread, not in its middle', () => {
    expect(edgeTap({ x: 60, y: 320 }, spread, 'spread')).toBe('prev');
    expect(edgeTap({ x: 790, y: 320 }, spread, 'spread')).toBe('next');
    expect(edgeTap({ x: 420, y: 320 }, spread, 'spread')).toBeNull();
    expect(edgeTap({ x: 790, y: 700 }, spread, 'spread')).toBeNull();
  });

  it('leaves the corners to the library so one tap never turns twice', () => {
    expect(edgeTap({ x: 30, y: 30 }, spread, 'spread')).toBeNull();
    expect(edgeTap({ x: 810, y: 610 }, spread, 'spread')).toBeNull();
  });

  it('measures a single page from its own edges', () => {
    expect(edgeTap({ x: 30, y: 250 }, single, 'single')).toBe('prev');
    expect(edgeTap({ x: 280, y: 250 }, single, 'single')).toBe('next');
    expect(edgeTap({ x: 150, y: 250 }, single, 'single')).toBeNull();
    expect(edgeTap({ x: 290, y: 480 }, single, 'single')).toBeNull();
  });
});
