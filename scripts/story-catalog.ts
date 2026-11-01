/**
 * The catalog of candidate stories, `catalog/stories.json`: every tale the shelves may get, in the order they are
 * written, with its shelf, origin, public-domain plot source and how far it has come (idea → text → media → live).
 * The story routine takes the first `idea` entries in order (docs/story-routine.md). Checked by `pnpm check:stories`
 * together with the stories themselves.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { SHELVES, type Shelf, type Story, storyMediaFiles } from '@truyen/story';
import { REPO_ROOT, STORY_FILE } from './story-files';

export const CATALOG_FILE = path.join(REPO_ROOT, 'catalog', 'stories.json');

/** Where the plot comes from: Vietnamese folk literature, or the world's public-domain tales. */
export const ORIGINS = ['vn-folk', 'world'] as const;
export type Origin = (typeof ORIGINS)[number];

/**
 * idea: not written yet. text: `stories/<slug>/story.json` has the words only, no media file. media: some pictures,
 * scene videos, voices or music exist. live: the whole story has its recording (`track`), so it plays with voice.
 */
export const STATUSES = ['idea', 'text', 'media', 'live'] as const;
export type CatalogStatus = (typeof STATUSES)[number];

export interface CatalogEntry {
  slug: string;
  title: string;
  shelf: Shelf;
  origin: Origin;
  /** The plot's source and why it is in the public domain, e.g. "Grimm, Kinder- und Hausmärchen 1857, Project Gutenberg, phạm vi công cộng". */
  plotSource: string;
  status: CatalogStatus;
}

/** What the catalog check needs to know of a story folder; null when its story.json is invalid (reported elsewhere). */
export interface StoryFacts {
  shelf: Shelf;
  title: string;
  status: Exclude<CatalogStatus, 'idea'>;
}

export interface CatalogReport {
  entries: CatalogEntry[];
  /** Fail the check: the catalog itself is wrong. */
  errors: string[];
  /**
   * Printed, never fail: the catalog lags behind the stories (a story written outside the routine, media made by
   * `pnpm story:build`), so another session's commit never turns the checks red.
   */
  warnings: string[];
}

const KEBAB = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const FIELDS = ['slug', 'title', 'shelf', 'origin', 'plotSource', 'status'] as const;
const MIN_PLOT_SOURCE_CHARS = 20;

/** The status a written story has, from its media. */
export function storyStatus(story: Story): StoryFacts['status'] {
  if (story.track) return 'live';
  return storyMediaFiles(story).length > 0 ? 'media' : 'text';
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function oneOf<T extends string>(values: readonly T[], value: unknown): value is T {
  return typeof value === 'string' && (values as readonly string[]).includes(value);
}

const nonEmpty = (value: unknown): value is string => typeof value === 'string' && value.trim().length > 0;

/** Shape of one entry; returns the entry or the problems found, each prefixed with its place in the catalog. */
function parseEntry(value: unknown, at: string): { entry?: CatalogEntry; errors: string[] } {
  if (!isRecord(value)) return { errors: [`${at}: expected an object`] };
  const errors: string[] = [];
  for (const key of Object.keys(value)) if (!(FIELDS as readonly string[]).includes(key)) errors.push(`${at}: unknown field "${key}"`);
  const { slug, title, shelf, origin, plotSource, status } = value;
  if (typeof slug !== 'string' || !KEBAB.test(slug)) errors.push(`${at}.slug: lowercase kebab-case without diacritics`);
  if (!nonEmpty(title)) errors.push(`${at}.title: required`);
  if (!oneOf(SHELVES, shelf)) errors.push(`${at}.shelf: one of ${SHELVES.join(', ')}`);
  if (!oneOf(ORIGINS, origin)) errors.push(`${at}.origin: one of ${ORIGINS.join(', ')}`);
  if (typeof plotSource !== 'string' || plotSource.trim().length < MIN_PLOT_SOURCE_CHARS) {
    errors.push(`${at}.plotSource: name the plot's source and why it is public domain (at least ${MIN_PLOT_SOURCE_CHARS} characters)`);
  }
  if (!oneOf(STATUSES, status)) errors.push(`${at}.status: one of ${STATUSES.join(', ')}`);
  if (errors.length > 0) return { errors };
  if (typeof slug !== 'string' || !nonEmpty(title) || !oneOf(SHELVES, shelf) || !oneOf(ORIGINS, origin)) return { errors };
  if (typeof plotSource !== 'string' || !oneOf(STATUSES, status)) return { errors };
  return { entry: { slug, title, shelf, origin, plotSource, status }, errors };
}

const titleKey = (title: string): string => title.normalize('NFC').toLowerCase().replace(/\s+/g, ' ').trim();

/**
 * Checks the catalog against itself and against the story folders (`stories` maps each folder that has a story.json
 * to its facts, or null when that story is invalid).
 */
export function checkCatalog(data: unknown, stories: ReadonlyMap<string, StoryFacts | null>): CatalogReport {
  const entries: CatalogEntry[] = [];
  const errors: string[] = [];
  const warnings: string[] = [];
  if (!Array.isArray(data)) return { entries, errors: ['catalog: expected an array of entries'], warnings };

  data.forEach((value, index) => {
    const parsed = parseEntry(value, `catalog[${index}]`);
    errors.push(...parsed.errors);
    if (parsed.entry) entries.push(parsed.entry);
  });

  const slugs = new Set<string>();
  const titles = new Map<string, string>();
  for (const entry of entries) {
    if (slugs.has(entry.slug)) errors.push(`catalog ${entry.slug}: listed twice`);
    slugs.add(entry.slug);
    const other = titles.get(titleKey(entry.title));
    if (other !== undefined && other !== entry.slug) errors.push(`catalog ${entry.slug}: same title as ${other} ("${entry.title}")`);
    titles.set(titleKey(entry.title), entry.slug);

    const has = stories.has(entry.slug);
    const facts = stories.get(entry.slug);
    if (entry.status === 'idea') {
      if (has) warnings.push(`catalog ${entry.slug}: stories/${entry.slug} exists; set its status (and shelf) to match the story`);
      continue;
    }
    if (!has) {
      errors.push(`catalog ${entry.slug}: status "${entry.status}" but stories/${entry.slug}/${STORY_FILE} does not exist`);
      continue;
    }
    if (!facts) continue;
    if (facts.shelf !== entry.shelf) warnings.push(`catalog ${entry.slug}: shelf "${entry.shelf}" but the story is on "${facts.shelf}"`);
    if (facts.status !== entry.status) warnings.push(`catalog ${entry.slug}: status "${entry.status}" but the story is "${facts.status}"`);
    if (facts.title !== entry.title) warnings.push(`catalog ${entry.slug}: title "${entry.title}" but the story says "${facts.title}"`);
  }

  for (const slug of [...stories.keys()].sort()) {
    if (!slugs.has(slug)) warnings.push(`catalog: stories/${slug} has no entry; add one`);
  }
  return { entries, errors, warnings };
}

/** Reads catalog/stories.json; a missing or unparsable file is reported as an error. */
export function readCatalog(file: string = CATALOG_FILE): { data?: unknown; error?: string } {
  try {
    return { data: JSON.parse(readFileSync(file, 'utf8')) as unknown };
  } catch (error) {
    return { error: `${path.relative(REPO_ROOT, file)}: ${error instanceof Error ? error.message : String(error)}` };
  }
}
