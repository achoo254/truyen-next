import type { StoryListEntry } from '@truyen/story';
import { describe, expect, it } from 'vitest';
import { EMPTY_QUERY, PAGE_SIZE, applyQuery, fold, highlight, lengthBand, parseQuery, queryString } from './library';

const entry = (slug: string, title: string, minutes: number, added: string, themes: StoryListEntry['themes'] = []): StoryListEntry => ({
  slug,
  shelf: 'kids',
  title,
  summary: `Tóm tắt của ${title}.`,
  scenes: 8,
  minutes,
  themes,
  added,
});

const LIST = [
  entry('son-tinh', 'Sơn Tinh, Thủy Tinh', 4, '2026-10-29', ['than-thoai']),
  entry('thanh-giong', 'Thánh Gióng', 6, '2026-10-30', ['anh-hung']),
  entry('dam-sen', 'Đầm sen', 12, '2026-10-28', ['thien-nhien']),
];

describe('library search', () => {
  it('ignores marks and đ, so plain typing finds Vietnamese titles', () => {
    expect(fold('Sơn Tinh, Thủy Tinh')).toBe('son tinh, thuy tinh');
    expect(fold('Đầm')).toBe('dam');
    expect(applyQuery(LIST, { ...EMPTY_QUERY, q: 'son tinh' }).items.map((e) => e.slug)).toEqual(['son-tinh']);
    expect(applyQuery(LIST, { ...EMPTY_QUERY, q: 'dam' }).items.map((e) => e.slug)).toEqual(['dam-sen']);
    expect(applyQuery(LIST, { ...EMPTY_QUERY, q: 'giong thanh' }).items.map((e) => e.slug)).toEqual(['thanh-giong']);
    expect(applyQuery(LIST, { ...EMPTY_QUERY, q: 'không có' }).total).toBe(0);
  });

  it('filters by topic and length, and orders newest, A–Z or shortest first', () => {
    expect(lengthBand(4)).toBe('ngan');
    expect(lengthBand(10)).toBe('vua');
    expect(lengthBand(11)).toBe('dai');
    expect(applyQuery(LIST, { ...EMPTY_QUERY, theme: 'anh-hung' }).items.map((e) => e.slug)).toEqual(['thanh-giong']);
    expect(applyQuery(LIST, { ...EMPTY_QUERY, length: 'dai' }).items.map((e) => e.slug)).toEqual(['dam-sen']);
    expect(applyQuery(LIST, EMPTY_QUERY).items.map((e) => e.slug)).toEqual(['thanh-giong', 'son-tinh', 'dam-sen']);
    expect(applyQuery(LIST, { ...EMPTY_QUERY, sort: 'a-z' }).items.map((e) => e.slug)).toEqual(['dam-sen', 'son-tinh', 'thanh-giong']);
    expect(applyQuery(LIST, { ...EMPTY_QUERY, sort: 'ngan' }).items.map((e) => e.slug)).toEqual(['son-tinh', 'thanh-giong', 'dam-sen']);
  });

  it('shows pages of 24 and says when there are more', () => {
    const many = Array.from({ length: 60 }, (_, i) => entry(`s${i}`, `Truyện ${i}`, 5, '2026-10-30'));
    expect(applyQuery(many, EMPTY_QUERY)).toMatchObject({ total: 60, hasMore: true });
    expect(applyQuery(many, EMPTY_QUERY).items).toHaveLength(PAGE_SIZE);
    expect(applyQuery(many, { ...EMPTY_QUERY, pages: 3 })).toMatchObject({ hasMore: false });
  });

  it('keeps the state in the URL, defaults left out, nonsense ignored', () => {
    const query = { q: 'sơn', theme: 'than-thoai' as const, length: 'ngan' as const, sort: 'a-z' as const, pages: 2 };
    const text = queryString(query);
    expect(text).toBe('?q=s%C6%A1n&chu-de=than-thoai&do-dai=ngan&sap-xep=a-z&trang=2');
    expect(parseQuery(text)).toEqual(query);
    expect(queryString(EMPTY_QUERY)).toBe('');
    expect(parseQuery('?chu-de=x&do-dai=y&sap-xep=z&trang=-3')).toEqual(EMPTY_QUERY);
    expect(parseQuery('?trang=999').pages).toBe(50);
  });

  it('marks the matching parts of a title', () => {
    expect(highlight('Sơn Tinh, Thủy Tinh', 'tinh')).toEqual([
      { text: 'Sơn ', hit: false },
      { text: 'Tinh', hit: true },
      { text: ', Thủy ', hit: false },
      { text: 'Tinh', hit: true },
    ]);
    expect(highlight('Thánh Gióng', '')).toEqual([{ text: 'Thánh Gióng', hit: false }]);
  });
});
