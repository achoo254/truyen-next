/**
 * Browsing a large shelf: whole-word search where plain typing ignores Vietnamese marks ("son tinh" finds "Sơn Tinh")
 * and typed marks are kept ("cá" is not "cả"), title matches first, filters by topic and
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

const WORD_CHAR = /[\p{L}\p{N}]/u;

/** A searched word: typed with marks it must match exactly ("cá" is not "cả"), typed plain it matches any marks. */
interface Term {
  text: string;
  plain: boolean;
  /** The last word, while still being typed, may be the start of a longer word. */
  prefix: boolean;
}

function terms(q: string): Term[] {
  const typed = q.normalize('NFC').toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? [];
  return typed.map((text, i) => ({ text, plain: fold(text) === text, prefix: i === typed.length - 1 && [...text].length >= 3 }));
}

/** Whole words only: "rồng" finds "con rồng", not "trong" or "rộng". */
function termMatches(term: Term, word: string): boolean {
  const candidate = term.plain ? fold(word) : word.normalize('NFC').toLowerCase();
  return candidate === term.text || (term.prefix && candidate.startsWith(term.text));
}

/** Start and end (in characters) of every word of `chars`. */
function wordSpans(chars: readonly string[]): Array<[number, number]> {
  const spans: Array<[number, number]> = [];
  let start = -1;
  chars.forEach((char, i) => {
    if (WORD_CHAR.test(char)) {
      if (start < 0) start = i;
    } else if (start >= 0) {
      spans.push([start, i]);
      start = -1;
    }
  });
  if (start >= 0) spans.push([start, chars.length]);
  return spans;
}

function textWords(text: string): string[] {
  return text.normalize('NFC').match(/[\p{L}\p{N}]+/gu) ?? [];
}

function allFound(found: readonly Term[], words: readonly string[]): boolean {
  return found.every((term) => words.some((word) => termMatches(term, word)));
}

export function lengthBand(minutes: number): LengthBand {
  if (minutes < 5) return 'ngan';
  return minutes <= 10 ? 'vua' : 'dai';
}

export function matchesSearch(entry: StoryListEntry, q: string): boolean {
  return allFound(terms(q), textWords(`${entry.title} ${entry.summary}`));
}

/** Stories whose title holds every searched word come first, then those whose title holds some of them. */
function titleRank(entry: StoryListEntry, found: readonly Term[]): number {
  const title = textWords(entry.title);
  if (allFound(found, title)) return 2;
  return found.some((term) => title.some((word) => termMatches(term, word))) ? 1 : 0;
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
  const found = terms(query.q);
  const order = compare(query.sort);
  const matching = entries
    .filter((entry) => matchesSearch(entry, query.q))
    .filter((entry) => query.theme === null || entry.themes.includes(query.theme))
    .filter((entry) => query.length === null || lengthBand(entry.minutes) === query.length)
    .map((entry) => ({ entry, rank: found.length ? titleRank(entry, found) : 0 }))
    .sort((a, b) => b.rank - a.rank || order(a.entry, b.entry))
    .map(({ entry }) => entry);
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
  const chars = [...text.normalize('NFC')];
  const found = terms(q);
  const hits = new Array<boolean>(chars.length).fill(false);
  for (const [start, end] of wordSpans(chars)) {
    const word = chars.slice(start, end).join('');
    if (found.some((term) => termMatches(term, word))) for (let i = start; i < end; i += 1) hits[i] = true;
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
