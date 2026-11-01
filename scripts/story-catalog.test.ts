import { readFileSync } from 'node:fs';
import path from 'node:path';
import { type Story, validateStory } from '@truyen/story';
import { describe, expect, it } from 'vitest';
import { type CatalogEntry, type StoryFacts, checkCatalog, readCatalog, storyStatus } from './story-catalog';
import { STORIES_DIR } from './story-files';

const entry = (overrides: Partial<CatalogEntry> = {}): CatalogEntry => ({
  slug: 'cay-khe',
  title: 'Cây khế',
  shelf: 'kids',
  origin: 'vn-folk',
  plotSource: 'Truyện cổ tích dân gian Việt Nam, truyền miệng, không ai giữ quyền',
  status: 'text',
  ...overrides,
});
const written = (facts: Partial<StoryFacts> = {}): StoryFacts => ({ shelf: 'kids', title: 'Cây khế', status: 'text', ...facts });
const check = (data: unknown, stories: Record<string, StoryFacts | null> = {}) => checkCatalog(data, new Map(Object.entries(stories)));

function readStory(slug: string): Story {
  const result = validateStory(JSON.parse(readFileSync(path.join(STORIES_DIR, slug, 'story.json'), 'utf8')), slug);
  if (!result.ok) throw new Error(result.errors.join('\n'));
  return result.story;
}

describe('checkCatalog', () => {
  it('accepts an entry that agrees with its story, and ideas that are not written yet', () => {
    const report = check([entry(), entry({ slug: 'cay-tao', title: 'Cây táo', status: 'idea' })], { 'cay-khe': written() });
    expect(report).toEqual({ entries: expect.any(Array) as unknown, errors: [], warnings: [] });
    expect(report.entries.map((e) => e.slug)).toEqual(['cay-khe', 'cay-tao']);
  });

  it('reports the shape of each entry with its place', () => {
    const { errors } = check([
      { ...entry(), slug: 'Cây Khế', shelf: 'teens', origin: 'mars', status: 'done', plotSource: 'sách', extra: 1 },
      'not an entry',
    ]);
    expect(errors).toEqual([
      'catalog[0]: unknown field "extra"',
      'catalog[0].slug: lowercase kebab-case without diacritics',
      expect.stringMatching(/^catalog\[0\]\.shelf: one of kids, adults/) as unknown,
      'catalog[0].origin: one of vn-folk, world',
      expect.stringMatching(/^catalog\[0\]\.plotSource: /) as unknown,
      'catalog[0].status: one of idea, text, media, live',
      'catalog[1]: expected an object',
    ]);
    expect(check({}).errors).toEqual(['catalog: expected an array of entries']);
  });

  it('refuses the same slug or the same title twice', () => {
    const { errors } = check([
      entry({ status: 'idea' }),
      entry({ status: 'idea' }),
      entry({ slug: 'cay-khe-2', title: 'cây  KHẾ', status: 'idea' }),
    ]);
    expect(errors).toEqual(['catalog cay-khe: listed twice', 'catalog cay-khe-2: same title as cay-khe ("cây  KHẾ")']);
  });

  it('refuses a written status without the story', () => {
    expect(check([entry()]).errors).toEqual(['catalog cay-khe: status "text" but stories/cay-khe/story.json does not exist']);
    // An invalid story is reported by the story check; the catalog does not guess its facts.
    expect(check([entry({ status: 'live' })], { 'cay-khe': null })).toMatchObject({ errors: [], warnings: [] });
  });

  it('only warns when the catalog lags behind the stories', () => {
    const report = check(
      [
        entry({ status: 'idea' }),
        entry({ slug: 'tam-cam', title: 'Tấm và Cám', status: 'text' }),
        entry({ slug: 'thanh-giong', title: 'Thánh Gióng', shelf: 'adults', status: 'text' }),
      ],
      {
        'cay-khe': written(),
        'tam-cam': written({ title: 'Tấm Cám' }),
        'thanh-giong': written({ title: 'Thánh Gióng', status: 'media' }),
        'so-dua': written({ title: 'Sọ Dừa' }),
      },
    );
    expect(report.errors).toEqual([]);
    expect(report.warnings).toEqual([
      'catalog cay-khe: stories/cay-khe exists; set its status (and shelf) to match the story',
      'catalog tam-cam: title "Tấm và Cám" but the story says "Tấm Cám"',
      'catalog thanh-giong: shelf "adults" but the story is on "kids"',
      'catalog thanh-giong: status "text" but the story is "media"',
      'catalog: stories/so-dua has no entry; add one',
    ]);
  });
});

describe('storyStatus', () => {
  it('is text while a story has no media, media once a file exists, live with the whole recording', () => {
    const story = readStory('son-tinh-thuy-tinh');
    expect(storyStatus(story)).toBe('text');
    expect(storyStatus({ ...story, music: { ...story.music, file: 'media/music.m4a' } })).toBe('media');
    expect(storyStatus({ ...story, track: { file: 'media/story.m4a', duration: 60, scenes: [] } })).toBe('live');
  });
});

describe('catalog/stories.json', () => {
  const { data, error } = readCatalog();

  it('parses and has no error of its own', () => {
    expect(error).toBeUndefined();
    const report = checkCatalog(data, new Map());
    expect(report.errors.filter((e) => !e.includes('does not exist'))).toEqual([]);
  });

  // Ideas run down as stories are written: the catalog keeps at least a week of them (100 a week) ahead.
  it('holds at least a week of public-domain candidates still to write, on every shelf', () => {
    const { entries } = checkCatalog(data, new Map());
    const ideas = entries.filter((e) => e.status === 'idea');
    expect(ideas.length).toBeGreaterThanOrEqual(100);
    expect(new Set(ideas.map((e) => e.shelf))).toEqual(new Set(['kids', 'adults', 'world']));
    for (const e of entries) expect(e.plotSource).toMatch(/phạm vi công cộng|không ai giữ quyền/);
  });
});
