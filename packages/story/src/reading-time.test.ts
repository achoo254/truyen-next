import { describe, expect, it } from 'vitest';
import { MIN_SCENE_SECONDS, SENTENCE_PAUSE_SECONDS, SYLLABLES_PER_SECOND, estimateReadingSeconds, subtitleIndexAt, subtitleStarts, syllableCount } from './reading-time.ts';

describe('reading time', () => {
  it('counts one syllable per written word, punctuation alone not counted', () => {
    expect(syllableCount('Xin chào các bạn nhỏ!')).toBe(5);
    expect(syllableCount('  Nước lên — núi lên…  ')).toBe(4);
    expect(syllableCount('')).toBe(0);
  });

  it('estimates the pace plus a breath per sentence, never under the minimum', () => {
    const text = 'một hai ba bốn năm sáu bảy tám chín mười mười một mười hai. Hết rồi!';
    expect(estimateReadingSeconds(text)).toBeCloseTo(syllableCount(text) / SYLLABLES_PER_SECOND + 2 * SENTENCE_PAUSE_SECONDS, 1);
    expect(estimateReadingSeconds('Chào!')).toBe(MIN_SCENE_SECONDS);
  });

  it('starts each subtitle line in proportion to its syllables', () => {
    expect(subtitleStarts(['một hai', 'ba bốn năm sáu', 'bảy tám'])).toEqual([0, 0.25, 0.75]);
    expect(subtitleIndexAt(['một hai', 'ba bốn năm sáu', 'bảy tám'], 0)).toBe(0);
    expect(subtitleIndexAt(['một hai', 'ba bốn năm sáu', 'bảy tám'], 0.5)).toBe(1);
    expect(subtitleIndexAt(['một hai', 'ba bốn năm sáu', 'bảy tám'], 1)).toBe(2);
    expect(subtitleIndexAt([], 0.5)).toBe(-1);
  });
});
