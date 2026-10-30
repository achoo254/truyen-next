import { describe, expect, it } from 'vitest';
import { readGesture } from './use-swipe';

const trace = (dx: number, dy = 0, ms = 300, startShare = 0.5) => ({ dx, dy, ms, startShare });

describe('page gestures', () => {
  it('turns on a long enough or fast enough sideways swipe', () => {
    expect(readGesture(trace(-60), false)).toBe('next');
    expect(readGesture(trace(60), false)).toBe('prev');
    expect(readGesture(trace(-30, 0, 60), false)).toBe('next');
    expect(readGesture(trace(-30, 0, 300), false)).toBeNull();
  });

  it('leaves vertical scrolling alone', () => {
    expect(readGesture(trace(-60, 120), false)).toBeNull();
  });

  it('turns on edge taps only when they are on', () => {
    expect(readGesture(trace(2, 1, 100, 0.1), true)).toBe('prev');
    expect(readGesture(trace(2, 1, 100, 0.9), true)).toBe('next');
    expect(readGesture(trace(2, 1, 100, 0.5), true)).toBeNull();
    expect(readGesture(trace(2, 1, 100, 0.9), false)).toBeNull();
  });
});
