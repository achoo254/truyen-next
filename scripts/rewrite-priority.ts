/**
 * `pnpm story:rewrite-priority --env-file <file>`: writes catalog/rewrite-priority.json, the shortened stories to retell
 * first (rewrite-priority-file.ts). Runs on the owner's PC with the read-only Search Console grant of Tiểu Đệ (the env
 * file holds YOUTUBE_CLIENT_ID, YOUTUBE_CLIENT_SECRET and SEARCH_CONSOLE_REFRESH_TOKEN; nothing secret is printed):
 *
 * 1. story pages with impressions in the last 28 days, most impressions first (people already see them);
 * 2. then story pages Google crawled but left out of the index (URL Inspection), longest telling first.
 *
 * Every other shortened story keeps the default order of the queue. URL Inspection allows 2,000 URLs a day per property,
 * enough for the whole queue in one run.
 */
import { readFileSync } from 'node:fs';
import { parseArgs } from 'node:util';
import { rewriteQueue } from './rewrite-queue-plan';
import { writeRewritePriority } from './rewrite-priority-file';
import { loadStories } from './story-files';

const ORIGIN = 'https://truyen.hoandat.com';
const PROPERTY = 'sc-domain:hoandat.com';
const API = 'https://searchconsole.googleapis.com';
const PARALLEL = 8;

function envValue(text: string, key: string): string {
  const line = text.split(/\r?\n/).find((l) => l.startsWith(`${key}=`));
  return line ? line.slice(key.length + 1).trim().replace(/^["']|["']$/g, '') : '';
}

async function accessToken(envFile: string): Promise<string> {
  const text = readFileSync(envFile, 'utf8');
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: envValue(text, 'YOUTUBE_CLIENT_ID'),
      client_secret: envValue(text, 'YOUTUBE_CLIENT_SECRET'),
      refresh_token: envValue(text, 'SEARCH_CONSOLE_REFRESH_TOKEN'),
      grant_type: 'refresh_token',
    }),
  });
  const body = (await res.json()) as { access_token?: string; error?: string };
  if (!body.access_token) throw new Error(`Search Console token refused: ${body.error ?? res.status}`);
  return body.access_token;
}

const slugOf = (url: string): string | null => /^https:\/\/truyen\.hoandat\.com\/truyen\/([a-z0-9-]+)\/?$/.exec(url)?.[1] ?? null;
const saigonDate = (d: Date): string => new Date(d.getTime() + 7 * 3_600_000).toISOString().slice(0, 10);

/** Story slug → impressions over the last 28 days. */
async function impressions(token: string): Promise<Map<string, number>> {
  const end = new Date();
  const start = new Date(end.getTime() - 28 * 86_400_000);
  const res = await fetch(`${API}/webmasters/v3/sites/${encodeURIComponent(PROPERTY)}/searchAnalytics/query`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      startDate: start.toISOString().slice(0, 10),
      endDate: end.toISOString().slice(0, 10),
      dimensions: ['page'],
      dimensionFilterGroups: [{ filters: [{ dimension: 'page', operator: 'contains', expression: `${ORIGIN}/truyen/` }] }],
      rowLimit: 5000,
    }),
  });
  if (!res.ok) throw new Error(`Search Analytics: HTTP ${res.status}`);
  const body = (await res.json()) as { rows?: { keys?: string[]; impressions?: number }[] };
  const out = new Map<string, number>();
  for (const row of body.rows ?? []) {
    const slug = slugOf(row.keys?.[0] ?? '');
    if (slug) out.set(slug, (out.get(slug) ?? 0) + (row.impressions ?? 0));
  }
  return out;
}

/** Whether Google crawled the page and left it out of the index. */
async function crawledNotIndexed(token: string, slug: string): Promise<boolean> {
  const res = await fetch(`${API}/v1/urlInspection/index:inspect`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ inspectionUrl: `${ORIGIN}/truyen/${slug}`, siteUrl: PROPERTY }),
  });
  if (!res.ok) throw new Error(`URL Inspection ${slug}: HTTP ${res.status}`);
  const body = (await res.json()) as { inspectionResult?: { indexStatusResult?: { coverageState?: string; pageFetchState?: string; verdict?: string } } };
  const status = body.inspectionResult?.indexStatusResult;
  // coverageState is a localized sentence; a successful fetch with a non-PASS verdict is the "crawled, not indexed" case.
  return status?.pageFetchState === 'SUCCESSFUL' && status.verdict !== 'PASS';
}

async function main(): Promise<void> {
  const { values } = parseArgs({ options: { 'env-file': { type: 'string' } } });
  const envFile = values['env-file'];
  if (!envFile) {
    console.error('usage: pnpm story:rewrite-priority --env-file <Tiểu Đệ env file>');
    process.exit(1);
  }
  const token = await accessToken(envFile);
  const queue = rewriteQueue(loadStories().stories).map((item) => item.slug);
  const shown = await impressions(token);
  const seen = queue.filter((slug) => (shown.get(slug) ?? 0) > 0).sort((a, b) => (shown.get(b) ?? 0) - (shown.get(a) ?? 0));
  const rest = queue.filter((slug) => !shown.has(slug));
  const crawled: string[] = [];
  for (let i = 0; i < rest.length; i += PARALLEL) {
    const batch = rest.slice(i, i + PARALLEL);
    const flags = await Promise.all(batch.map((slug) => crawledNotIndexed(token, slug)));
    batch.forEach((slug, at) => flags[at] && crawled.push(slug));
  }
  writeRewritePriority({ updated: saigonDate(new Date()), slugs: [...seen, ...crawled] });
  console.log(`priority: ${seen.length} with impressions, ${crawled.length} crawled but not indexed (inspected ${rest.length} of ${queue.length} queued)`);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
