/**
 * Browsing a large shelf: search that ignores Vietnamese marks ("son tinh" finds "Sơn Tinh"), filters by topic and
 * length, three orders, and pages of 24. The whole state lives in the URL (`?q=&chu-de=&do-dai=&sap-xep=&trang=`),
 * so reload, Back and a shared link keep it. Pure: the list is small enough (a few hundred entries) to filter in
 * the browser.
 */
import { type StoryListEntry, THEMES, type Theme } from '@truyen/story';

export const PAGE_SIZE = 24;
export const LENGTHS = ['ngan', 'vua', 'dai'] as const;
export type LengthBand = (typeof LENGTHS)[number];
export const SORTS = ['moi', 'a-z', 'ngan'] as const;
export type SortOrder = (typeof SORTS)[number];

export interface ShelfQuery {
  q: string;
  theme: Theme | null;
  length: LengthBand | null;
  sort: SortOrder;
  /** How many pages of PAGE_SIZE are shown ("Xem thêm" adds one). */
  pages: number;
}

export const EMPTY_QUERY: ShelfQuery = { q: '', theme: null, length: null, sort: 'moi', pages: 1 };
const MAX_PAGES = 50;

/** Lower case without marks, đ as d: what search compares. Folds one character at a time, so positions match the original. */
export function foldChar(char: string): string {
  return char.normalize('NFD').replace(/\p{M}/gu, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').toLowerCase();
}

export function fold(text: string): string {
  return [...text].map(foldChar).join('');
}

function words(q: string): string[] {
  return fold(q).split(/\s+/).filter(Boolean);
}

export function lengthBand(minutes: number): LengthBand {
  if (minutes < 5) return 'ngan';
  return minutes <= 10 ? 'vua' : 'dai';
}

export function matchesSearch(entry: StoryListEntry, q: string): boolean {
  const haystack = fold(`${entry.title} ${entry.summary}`);
  return words(q).every((word) => haystack.includes(word));
}

const collator = new Intl.Collator('vi');

function compare(sort: SortOrder): (a: StoryListEntry, b: StoryListEntry) => number {
  const byTitle = (a: StoryListEntry, b: StoryListEntry): number => collator.compare(a.title, b.title);
  if (sort === 'a-z') return byTitle;
  if (sort === 'ngan') return (a, b) => a.minutes - b.minutes || byTitle(a, b);
  return (a, b) => b.added.localeCompare(a.added) || byTitle(a, b);
}

export interface ShelfView {
  items: StoryListEntry[];
  /** How many stories match, before paging. */
  total: number;
  hasMore: boolean;
}

export function applyQuery(entries: readonly StoryListEntry[], query: ShelfQuery): ShelfView {
  const matching = entries
    .filter((entry) => matchesSearch(entry, query.q))
    .filter((entry) => query.theme === null || entry.themes.includes(query.theme))
    .filter((entry) => query.length === null || lengthBand(entry.minutes) === query.length)
    .sort(compare(query.sort));
  const shown = query.pages * PAGE_SIZE;
  return { items: matching.slice(0, shown), total: matching.length, hasMore: matching.length > shown };
}

const pick = <T extends string>(options: readonly T[], value: string | null): T | null => (value !== null && (options as readonly string[]).includes(value) ? (value as T) : null);

export function parseQuery(search: string): ShelfQuery {
  const params = new URLSearchParams(search);
  const pages = Number(params.get('trang'));
  return {
    q: (params.get('q') ?? '').slice(0, 80),
    theme: pick(THEMES, params.get('chu-de')),
    length: pick(LENGTHS, params.get('do-dai')),
    sort: pick(SORTS, params.get('sap-xep')) ?? 'moi',
    pages: Number.isInteger(pages) && pages >= 1 ? Math.min(pages, MAX_PAGES) : 1,
  };
}

/** The query string for a state, defaults left out (an empty state is ""). */
export function queryString(query: ShelfQuery): string {
  const params = new URLSearchParams();
  if (query.q.trim()) params.set('q', query.q.trim());
  if (query.theme) params.set('chu-de', query.theme);
  if (query.length) params.set('do-dai', query.length);
  if (query.sort !== 'moi') params.set('sap-xep', query.sort);
  if (query.pages > 1) params.set('trang', String(query.pages));
  const text = params.toString();
  return text ? `?${text}` : '';
}

export interface Segment {
  text: string;
  hit: boolean;
}

/** `text` cut into the parts that match a search word (marked) and the rest, for highlighting. */
export function highlight(text: string, q: string): Segment[] {
  const chars = [...text];
  const folded = chars.map(foldChar).join('');
  const hits = new Array<boolean>(chars.length).fill(false);
  for (const word of words(q)) {
    for (let at = folded.indexOf(word); at >= 0; at = folded.indexOf(word, at + 1)) for (let i = at; i < at + word.length; i += 1) hits[i] = true;
  }
  const segments: Segment[] = [];
  chars.forEach((char, i) => {
    const hit = hits[i] ?? false;
    const last = segments.at(-1);
    if (last && last.hit === hit) last.text += char;
    else segments.push({ text: char, hit });
  });
  return segments;
}
