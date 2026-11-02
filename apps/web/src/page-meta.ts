import { brand } from './brand';

/**
 * The tab title and the description of the page on screen. The build writes both into each prerendered page; this
 * keeps them right while the reader moves between pages without a reload.
 */
export function setPageMeta(title: string, description: string): void {
  document.title = `${title} · ${brand.appName}`;
  for (const selector of ['meta[name="description"]', 'meta[property="og:description"]']) {
    document.querySelector(selector)?.setAttribute('content', description);
  }
}

/**
 * Keeps search engines off the page on screen (the reader's own pages): a robots meta tag in the head. nginx also
 * sends X-Robots-Tag for those addresses (infra/nginx/truyen.hoandat.com.conf).
 */
export function setNoIndex(): void {
  if (document.querySelector('meta[name="robots"]')) return;
  const meta = document.createElement('meta');
  meta.name = 'robots';
  meta.content = 'noindex, nofollow';
  document.head.append(meta);
}
