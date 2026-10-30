import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import { siteIndexing } from './site-indexing.ts';
import { prerender } from './vite-prerender.ts';
import { brandAssets } from './vite-brand.ts';
import { storyFiles } from './vite-stories.ts';
import { pageFlipWithoutInlineStyle } from './vite-page-flip.ts';
import { NATIVE_MODE, NATIVE_OUT_DIR, nativePolicy, nativeStoryOrigin } from './vite-native.ts';

/** A static site: no API. The stories (stories/ at the repository root) are served and copied by vite-stories.ts;
 * robots.txt and the noindex signals come from site-indexing.ts; each page's own HTML from vite-prerender.ts; the
 * page-turn library loses its inline <style> (CSP) in vite-page-flip.ts. `--mode native` is the iPhone app's build
 * (vite-native.ts): the app only, into dist-native/, reading the stories from the site. */
export default defineConfig(({ mode }) => {
  const native = mode === NATIVE_MODE;
  // '' on the web: every story address is relative to the site.
  const storyOrigin = native ? nativeStoryOrigin(process.env) : '';
  const site = native ? [nativePolicy(storyOrigin), ...(storyOrigin === '' ? [storyFiles()] : [])] : [storyFiles(), siteIndexing(), prerender()];
  return {
    plugins: [react(), brandAssets(), ...site, pageFlipWithoutInlineStyle()],
    define: { 'import.meta.env.VITE_TRUYEN_STORY_ORIGIN': JSON.stringify(storyOrigin) },
    // Served through the plugins (not pre-bundled), so the dev server drops the inline <style> too.
    optimizeDeps: { exclude: ['page-flip'] },
    server: { port: 5301, strictPort: true },
    preview: { port: 5301, strictPort: true },
    build: {
      target: 'es2022',
      ...(native ? { outDir: NATIVE_OUT_DIR } : {}),
      // Fonts stay as files: a strict CSP (font-src 'self') refuses data: fonts.
      assetsInlineLimit: (file: string) => (/\.(woff2?|ttf|otf)$/.test(file) ? false : undefined),
      sourcemap: true,
    },
  };
});
