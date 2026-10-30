import { describe, expect, it } from 'vitest';
import { brand } from '../brand';
import { format, initialLocale, translator } from './i18n';
import { en, vi } from './messages';

describe('i18n', () => {
  it('has every key in both languages', () => {
    expect(Object.keys(en).sort()).toEqual(Object.keys(vi).sort());
  });

  it('fills placeholders and the brand name', () => {
    expect(format('{app}: {n}/{total}', { n: 2, total: 8 })).toBe(`${brand.appName}: 2/8`);
    expect(format('{missing}')).toBe('{missing}');
    expect(translator('en')('story.sceneOf', { n: 1, total: 8 })).toBe('Scene 1/8');
  });

  it('takes ?lang= first, then the saved choice, then Vietnamese', () => {
    expect(initialLocale('?lang=en', 'vi')).toBe('en');
    expect(initialLocale('?lang=fr', 'en')).toBe('en');
    expect(initialLocale('', undefined)).toBe('vi');
  });
});
