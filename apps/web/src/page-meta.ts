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
