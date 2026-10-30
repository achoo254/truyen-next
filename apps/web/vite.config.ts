import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import { siteIndexing } from './site-indexing.ts';
import { prerender } from './vite-prerender.ts';
import { brandAssets } from './vite-brand.ts';
import { storyFiles } from './vite-stories.ts';
import { pageFlipWithoutInlineStyle } from './vite-page-flip.ts';

/** A static site: no API. The stories (stories/ at the repository root) are served and copied by vite-stories.ts;
 * robots.txt and the noindex signals come from site-indexing.ts; each page's own HTML from vite-prerender.ts; the
 * page-turn library loses its inline <style> (CSP) in vite-page-flip.ts. */
export default defineConfig({
  plugins: [react(), brandAssets(), storyFiles(), siteIndexing(), prerender(), pageFlipWithoutInlineStyle()],
  // Served through the plugins (not pre-bundled), so the dev server drops the inline <style> too.
  optimizeDeps: { exclude: ['page-flip'] },
  server: { port: 5301, strictPort: true },
  preview: { port: 5301, strictPort: true },
  build: {
    target: 'es2022',
    // Fonts stay as files: a strict CSP (font-src 'self') refuses data: fonts.
    assetsInlineLimit: (file) => (/\.(woff2?|ttf|otf)$/.test(file) ? false : undefined),
    sourcemap: true,
  },
});
