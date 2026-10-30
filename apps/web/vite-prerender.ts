/*
 * Pages written at build time, so each address answers with its own title, description, link preview and a plain
 * list of its stories before any script runs (search engines, link previews, slow phones):
 *
 * - index.html: the home page, both shelves listed;
 * - tre-em/index.html, nguoi-lon/index.html: one shelf each;
 * - truyen/<slug>/index.html: one story (title, summary, length, shelf; JSON-LD CreativeWork);
 * - spa.html: the untouched app page, which nginx serves for every other address (legal pages, 404);
 * - sitemap.xml, only once the site may be indexed (site-indexing.ts).
 *
 * The app replaces the static body when it starts. The static markup has no inline script or style (the CSP allows
 * neither; JSON-LD is data, never run).
 */
import { existsSync } from 'node:fs';
import path from 'node:path';
import type { Plugin } from 'vite';
import { SHELVES, type Shelf, type StoryListEntry, storyListEntry } from '@truyen/story';
import { loadStories } from '../../scripts/story-files.ts';
import { vi } from './src/i18n/messages.ts';
import { INDEXABLE } from './site-indexing.ts';
import { loadTruyenBrand } from './vite-brand.ts';
import { primaryOrigin } from '@achoo254/brand/hosts';

/** nginx's fallback for every address without its own page (infra/nginx/truyen.hoandat.com.conf). */
export const SPA_FALLBACK = 'spa.html';

const SHELF_PATHS: Record<Shelf, string> = { kids: '/tre-em', adults: '/nguoi-lon' };

const ESCAPES: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
export const escapeHtml = (value: string): string => value.replace(/[&<>"']/g, (char) => ESCAPES[char] ?? char);

const fill = (template: string, vars: Record<string, string | number>): string => template.replace(/\{(\w+)\}/g, (whole, name: string) => String(vars[name] ?? whole));

export interface PrerenderContext {
  origin: string;
  appName: string;
  stories: readonly StoryListEntry[];
}

interface PageHead {
  /** Site path, e.g. "/truyen/tam-cam". */
  path: string;
  title: string;
  description: string;
  type?: 'website' | 'article';
  jsonLd?: object;
}

function replaceOnce(html: string, pattern: RegExp, replacement: string, what: string): string {
  if (!pattern.test(html)) throw new Error(`prerender: index.html has no ${what}`);
  return html.replace(pattern, replacement);
}

/** The built index.html with this page's head and body. */
export function renderPage(html: string, head: PageHead, body: string, ctx: PrerenderContext): string {
  const url = `${ctx.origin}${head.path === '/' ? '/' : head.path}`;
  const title = escapeHtml(head.title);
  const description = escapeHtml(head.description);
  let out = html;
  out = replaceOnce(out, /<title>[^<]*<\/title>/, `<title>${title}</title>`, '<title>');
  out = replaceOnce(out, /<meta name="description" content="[^"]*" \/>/, `<meta name="description" content="${description}" />`, 'description');
  out = replaceOnce(out, /<link rel="canonical" href="[^"]*" \/>/, `<link rel="canonical" href="${escapeHtml(url)}" />`, 'canonical link');
  out = replaceOnce(out, /<meta property="og:type" content="[^"]*" \/>/, `<meta property="og:type" content="${head.type ?? 'website'}" />`, 'og:type');
  out = replaceOnce(out, /<meta property="og:title" content="[^"]*" \/>/, `<meta property="og:title" content="${title}" />`, 'og:title');
  out = replaceOnce(out, /<meta property="og:description" content="[^"]*" \/>/, `<meta property="og:description" content="${description}" />`, 'og:description');
  out = replaceOnce(out, /<meta property="og:url" content="[^"]*" \/>/, `<meta property="og:url" content="${escapeHtml(url)}" />`, 'og:url');
  if (head.jsonLd) {
    // "<" escaped so no text in the data can close the element.
    const data = JSON.stringify(head.jsonLd).replace(/</g, '\\u003c');
    out = replaceOnce(out, /<\/head>/, `  <script type="application/ld+json">${data}</script>\n  </head>`, '</head>');
  }
  return replaceOnce(out, /<div id="root"><\/div>/, `<div id="root">${body}</div>`, '#root');
}

function storyList(entries: readonly StoryListEntry[]): string {
  const items = entries.map(
    (entry) =>
      `<li><a href="/truyen/${encodeURIComponent(entry.slug)}" lang="vi">${escapeHtml(entry.title)}</a> · ${escapeHtml(fill(vi['home.minutes'], { minutes: entry.minutes }))}<p lang="vi">${escapeHtml(entry.summary)}</p></li>`,
  );
  return `<ul class="prerender-list">${items.join('')}</ul>`;
}

const frame = (inner: string): string => `<main class="prerender container">${inner}</main>`;

/** File name in the build → page, for every prerendered page. */
export function prerenderPages(html: string, ctx: PrerenderContext): Map<string, string> {
  const pages = new Map<string, string>();
  const byShelf = (shelf: Shelf): StoryListEntry[] => ctx.stories.filter((entry) => entry.shelf === shelf);
  const homeTitle = `${vi['home.title']} · ${ctx.appName}`;

  pages.set(SPA_FALLBACK, html);
  const shelves = SHELVES.map(
    (shelf) => `<section><h2><a href="${SHELF_PATHS[shelf]}">${escapeHtml(vi[`shelf.${shelf}`])}</a></h2>${storyList(byShelf(shelf))}</section>`,
  ).join('');
  pages.set(
    'index.html',
    renderPage(html, { path: '/', title: homeTitle, description: vi['home.description'] }, frame(`<h1>${escapeHtml(vi['home.title'])}</h1><p>${escapeHtml(vi['home.lede'])}</p>${shelves}`), ctx),
  );

  for (const shelf of SHELVES) {
    const title = vi[`shelf.${shelf}.title`];
    pages.set(
      `${SHELF_PATHS[shelf].slice(1)}/index.html`,
      renderPage(
        html,
        { path: SHELF_PATHS[shelf], title: `${title} · ${ctx.appName}`, description: vi[`shelf.${shelf}.description`] },
        frame(`<h1>${escapeHtml(title)}</h1><p>${escapeHtml(vi[`shelf.${shelf}.lede`])}</p>${storyList(byShelf(shelf))}<p><a href="/">${escapeHtml(vi['shelf.all'])}</a></p>`),
        ctx,
      ),
    );
  }

  for (const entry of ctx.stories) {
    const path = `/truyen/${encodeURIComponent(entry.slug)}`;
    const shelfName = vi[`shelf.${entry.shelf}`];
    const jsonLd = {
      '@context': 'https://schema.org',
      '@type': 'CreativeWork',
      name: entry.title,
      description: entry.summary,
      inLanguage: 'vi',
      url: `${ctx.origin}${path}`,
      genre: entry.themes.map((theme) => vi[`theme.${theme}`]),
      audience: { '@type': 'Audience', audienceType: entry.shelf === 'kids' ? 'children' : 'adults' },
      timeRequired: `PT${entry.minutes}M`,
      isPartOf: { '@type': 'WebSite', name: ctx.appName, url: `${ctx.origin}/` },
    };
    const body = frame(
      `<p><a href="${SHELF_PATHS[entry.shelf]}">${escapeHtml(fill(vi['story.backToShelf'], { shelf: shelfName }))}</a></p>` +
        `<h1 lang="vi">${escapeHtml(entry.title)}</h1>` +
        `<p>${escapeHtml(fill(vi['story.length'], { minutes: entry.minutes, scenes: entry.scenes }))}</p>` +
        `<p lang="vi">${escapeHtml(entry.summary)}</p>`,
    );
    pages.set(`truyen/${entry.slug}/index.html`, renderPage(html, { path, title: `${entry.title} · ${ctx.appName}`, description: entry.summary, type: 'article', jsonLd }, body, ctx));
  }
  return pages;
}

/** Every page address, for the sitemap. */
export function sitemap(ctx: PrerenderContext): string {
  const paths = ['/', ...SHELVES.map((shelf) => SHELF_PATHS[shelf]), ...ctx.stories.map((entry) => `/truyen/${encodeURIComponent(entry.slug)}`)];
  const urls = paths.map((path) => `  <url><loc>${escapeHtml(`${ctx.origin}${path}`)}</loc></url>`).join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`;
}

/** Writes the pages into the build after index.html is final (its asset tags and robots meta are in). */
export function prerender(indexable: boolean = INDEXABLE): Plugin {
  return {
    name: 'truyen-prerender',
    enforce: 'post',
    // `vite preview` (the local e2e run) answers like nginx: /truyen/<slug> gets truyen/<slug>/index.html.
    configurePreviewServer(server) {
      const outDir = path.resolve(server.config.root, server.config.build.outDir);
      server.middlewares.use((req, _res, next) => {
        const [pathname = '', search = ''] = (req.url ?? '').split(/(?=\?)/);
        const page = path.join(outDir, decodeURIComponent(pathname), 'index.html');
        if (!path.extname(pathname) && page.startsWith(outDir) && existsSync(page)) req.url = `${pathname.replace(/\/?$/, '/')}index.html${search}`;
        next();
      });
    },
    generateBundle(_options, bundle) {
      const index = bundle['index.html'];
      if (!index || index.type !== 'asset' || typeof index.source !== 'string') {
        this.error('prerender: no index.html in the build');
      }
      const { stories, errors } = loadStories();
      if (errors.length > 0) this.error(`prerender: stories:\n  ${errors.join('\n  ')}`);
      const brand = loadTruyenBrand();
      const ctx: PrerenderContext = { origin: primaryOrigin(brand), appName: brand.appName, stories: stories.map(({ story }) => storyListEntry(story)) };
      const pages = prerenderPages(index.source, ctx);
      for (const [fileName, source] of pages) {
        if (fileName === 'index.html') index.source = source;
        else this.emitFile({ type: 'asset', fileName, source });
      }
      if (indexable) this.emitFile({ type: 'asset', fileName: 'sitemap.xml', source: sitemap(ctx) });
    },
  };
}
