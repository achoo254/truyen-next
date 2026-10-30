/*
 * Whether search engines may index the site: the one switch for the launch.
 *
 * The site is live but not promoted yet, so INDEXABLE is false and every build carries all three signals:
 * - robots.txt with `Disallow: /`;
 * - <meta name="robots" content="noindex, nofollow"> in index.html (every page: the app is a single page);
 * - the marker file NOINDEX_MARKER at the site root. nginx (infra/nginx/truyen.hoandat.com.conf) sends
 *   `X-Robots-Tag: noindex, nofollow` on every response while that file is in the release it serves.
 *
 * To launch: set INDEXABLE to true, commit, release (docs/deployment-guide.md). The build then allows robots,
 * drops the meta tag and the marker, and nginx stops sending the header; nothing to change on the server.
 */
import type { Plugin } from 'vite';

export const INDEXABLE = false;

/** Site-root file whose presence makes nginx send X-Robots-Tag; its content is only a note for whoever finds it. */
export const NOINDEX_MARKER = 'noindex';

export const ROBOTS_DIRECTIVE = 'noindex, nofollow';

const ROBOTS_META = `<meta name="robots" content="${ROBOTS_DIRECTIVE}" />`;

/** File name → content of what the build adds at the site root. */
export function indexingFiles(indexable: boolean): ReadonlyMap<string, string> {
  if (indexable) return new Map([['robots.txt', 'User-agent: *\nAllow: /\n']]);
  return new Map([
    ['robots.txt', 'User-agent: *\nDisallow: /\n'],
    [NOINDEX_MARKER, 'Not indexed yet: nginx sends X-Robots-Tag while this file exists (apps/web/site-indexing.ts).\n'],
  ]);
}

/** index.html with the robots meta tag added before </head> when the site must not be indexed. */
export function renderRobotsMeta(html: string, indexable: boolean): string {
  if (indexable) return html;
  if (!html.includes('</head>')) throw new Error('site indexing: index.html has no </head>');
  return html.replace('</head>', `  ${ROBOTS_META}\n  </head>`);
}

export function siteIndexing(indexable: boolean = INDEXABLE): Plugin {
  return {
    name: 'truyen-site-indexing',
    transformIndexHtml: (html) => renderRobotsMeta(html, indexable),
    generateBundle() {
      for (const [fileName, source] of indexingFiles(indexable)) this.emitFile({ type: 'asset', fileName, source });
    },
  };
}
