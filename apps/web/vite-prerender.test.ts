import type { StoryListEntry } from '@truyen/story';
import { describe, expect, it } from 'vitest';
import { SPA_FALLBACK, prerenderPages, sitemap } from './vite-prerender';

const HTML = `<html><head>
<title>App · Cổ tích</title>
<meta name="description" content="site" />
<link rel="canonical" href="https://truyen.hoandat.com/" />
<meta property="og:type" content="website" />
<meta property="og:title" content="App" />
<meta property="og:description" content="site" />
<meta property="og:url" content="https://truyen.hoandat.com/" />
<meta name="robots" content="noindex, nofollow" />
</head><body><div id="root"></div></body></html>`;

const entry = (slug: string, shelf: 'kids' | 'adults', title: string): StoryListEntry => ({ slug, shelf, title, summary: `${title} "& <b>"`, scenes: 8, minutes: 4, themes: ['su-tich'], added: '2026-10-30' });
const CTX = {
  origin: 'https://truyen.hoandat.com',
  appName: 'Truyện',
  stories: [entry('tam-cam', 'kids', 'Tấm Cám'), entry('su-tich-ho-guom', 'adults', 'Sự tích Hồ Gươm')],
  narration: new Map([['tam-cam', ['Ngày xưa có cô Tấm.', 'Tấm <hiền> & Cám.']]]),
};

describe('prerendered pages', () => {
  const pages = prerenderPages(HTML, CTX);

  it('writes the home page, both shelves, every story and the untouched app page', () => {
    expect([...pages.keys()].sort()).toEqual([SPA_FALLBACK, 'index.html', 'nguoi-lon/index.html', 'tre-em/index.html', 'truyen/su-tich-ho-guom/index.html', 'truyen/tam-cam/index.html'].sort());
    expect(pages.get(SPA_FALLBACK)).toBe(HTML);
  });

  it('gives a story page its own title, description, address, preview and data, with its title in the body', () => {
    const page = pages.get('truyen/tam-cam/index.html') ?? '';
    expect(page).toContain('<title>Tấm Cám · Truyện</title>');
    expect(page).toContain('<meta name="description" content="Tấm Cám &quot;&amp; &lt;b&gt;&quot;" />');
    expect(page).toContain('<link rel="canonical" href="https://truyen.hoandat.com/truyen/tam-cam" />');
    expect(page).toContain('<meta property="og:type" content="article" />');
    expect(page).toContain('<h1 lang="vi">Tấm Cám</h1>');
    expect(page).toContain('href="/tre-em"');
    // The whole tale is in the page, one paragraph per scene, escaped.
    expect(page).toContain('<article lang="vi"><p>Ngày xưa có cô Tấm.</p><p>Tấm &lt;hiền&gt; &amp; Cám.</p></article>');
    expect(pages.get('truyen/su-tich-ho-guom/index.html')).not.toContain('<article');
    const ld = /<script type="application\/ld\+json">(.*?)<\/script>/.exec(page)?.[1] ?? '';
    expect(ld).not.toContain('<');
    expect(JSON.parse(ld)).toMatchObject({ '@type': 'CreativeWork', name: 'Tấm Cám', inLanguage: 'vi', timeRequired: 'PT4M', genre: ['Sự tích'] });
    // Still not indexed: the robots meta of the build stays.
    expect(page).toContain('<meta name="robots" content="noindex, nofollow" />');
  });

  it('lists each shelf on its page and both on the home page', () => {
    const kids = pages.get('tre-em/index.html') ?? '';
    expect(kids).toContain('href="/truyen/tam-cam"');
    expect(kids).not.toContain('href="/truyen/su-tich-ho-guom"');
    expect(kids).toContain('<link rel="canonical" href="https://truyen.hoandat.com/tre-em" />');
    const home = pages.get('index.html') ?? '';
    expect(home).toContain('href="/truyen/tam-cam"');
    expect(home).toContain('href="/truyen/su-tich-ho-guom"');
  });

  it('fails loudly when the page lacks a tag it must fill', () => {
    expect(() => prerenderPages('<html><head></head><body></body></html>', CTX)).toThrow(/<title>/);
  });

  it('lists every page in the sitemap', () => {
    const xml = sitemap(CTX);
    expect(xml).toContain('<loc>https://truyen.hoandat.com/</loc>');
    expect(xml).toContain('<loc>https://truyen.hoandat.com/truyen/su-tich-ho-guom</loc>');
  });
});
