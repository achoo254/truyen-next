/**
 * catalog/rewrite-priority.json: the shortened stories to retell first, because Google already shows them in results or
 * has crawled them without indexing them (a short telling is a likely reason). Written by `pnpm story:rewrite-priority`
 * on the owner's PC, read by `pnpm story:rewrite-queue`. Holds slugs only: no Search Console numbers in this public repo.
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { REPO_ROOT } from './story-files';

export const REWRITE_PRIORITY_FILE = path.join(REPO_ROOT, 'catalog', 'rewrite-priority.json');

export interface RewritePriority {
  /** YYYY-MM-DD (Vietnam time) the list was made. */
  updated: string;
  slugs: string[];
}

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/** Checks the shape; a malformed file is an error rather than a silent reorder of the queue. */
export function parseRewritePriority(value: unknown): RewritePriority {
  if (typeof value !== 'object' || value === null) throw new Error('rewrite-priority.json: not an object');
  const { updated, slugs } = value as Record<string, unknown>;
  if (typeof updated !== 'string' || !DATE.test(updated)) throw new Error('rewrite-priority.json: "updated" must be YYYY-MM-DD');
  if (!Array.isArray(slugs) || !slugs.every((slug): slug is string => typeof slug === 'string' && SLUG.test(slug))) {
    throw new Error('rewrite-priority.json: "slugs" must be a list of story slugs');
  }
  return { updated, slugs };
}

/** The priority slugs in order, or none when the file is missing. */
export function readRewritePriority(file: string = REWRITE_PRIORITY_FILE): string[] {
  if (!existsSync(file)) return [];
  return parseRewritePriority(JSON.parse(readFileSync(file, 'utf8'))).slugs;
}

export function writeRewritePriority(priority: RewritePriority, file: string = REWRITE_PRIORITY_FILE): void {
  const checked = parseRewritePriority(priority);
  const lines = checked.slugs.map((slug) => `    ${JSON.stringify(slug)}`).join(',\n');
  writeFileSync(file, `{\n  "updated": ${JSON.stringify(checked.updated)},\n  "slugs": [\n${lines}\n  ]\n}\n`);
}
