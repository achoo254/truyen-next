import { describe, expect, it } from 'vitest';
import { NOINDEX_MARKER, ROBOTS_DIRECTIVE, indexingFiles, renderRobotsMeta } from './site-indexing';

const HTML = '<html><head><title>t</title></head><body></body></html>';

describe('site indexing', () => {
  it('keeps robots out, tags the page and leaves the marker nginx looks for while not indexable', () => {
    const files = indexingFiles(false, 'https://truyen.hoandat.com');
    expect(files.get('robots.txt')).toBe('User-agent: *\nDisallow: /\n');
    expect(files.has(NOINDEX_MARKER)).toBe(true);
    const html = renderRobotsMeta(HTML, false);
    expect(html).toContain(`<meta name="robots" content="${ROBOTS_DIRECTIVE}" />`);
    expect(html.indexOf('name="robots"')).toBeLessThan(html.indexOf('</head>'));
  });

  it('lets robots in with no meta tag and no marker once indexable', () => {
    const files = indexingFiles(true, 'https://truyen.hoandat.com');
    expect([...files.keys()]).toEqual(['robots.txt']);
    expect(files.get('robots.txt')).toBe('User-agent: *\nAllow: /\nSitemap: https://truyen.hoandat.com/sitemap.xml\n');
    expect(renderRobotsMeta(HTML, true)).toBe(HTML);
  });

  it('refuses an index.html it cannot tag', () => {
    expect(() => renderRobotsMeta('<html><body></body></html>', false)).toThrow(/no <\/head>/);
  });
});
