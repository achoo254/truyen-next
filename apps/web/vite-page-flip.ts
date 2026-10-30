import type { Plugin } from 'vite';

/** The library's ES build, imported by that path (its package.json only names the UMD build). */
export const PAGE_FLIP_MODULE = 'page-flip/dist/js/page-flip.module.js';

/**
 * page-flip 2.0.7 adds its stylesheet at load time with a `<style>` element; the site's CSP (`style-src 'self'`)
 * refuses inline style elements and reports each refusal as a console error. This is the style-inject helper the
 * library's build wrapped round its CSS: `!function(t,e){…}("…css…");`. Its rules live in app.css instead.
 */
const STYLE_INJECTOR = /!function\(t,e\)\{void 0===e&&\(e=\{\}\);var i=e\.insertAt;[\s\S]*?\}\("(?:[^"\\]|\\.)*"\);/g;

/** The module without the style injector; throws when the injector is not there exactly once (another version). */
export function stripStyleInjector(code: string): string {
  const found = code.match(STYLE_INJECTOR)?.length ?? 0;
  if (found !== 1) throw new Error(`page-flip: expected one style injector in ${PAGE_FLIP_MODULE}, found ${found}; check the pinned version`);
  return code.replace(STYLE_INJECTOR, '');
}

/** Vite plugin: serves page-flip without its `<style>` injector. */
export function pageFlipWithoutInlineStyle(): Plugin {
  return {
    name: 'truyen-page-flip-without-inline-style',
    enforce: 'pre',
    transform(code, id) {
      if (!id.split('?')[0]?.endsWith(PAGE_FLIP_MODULE)) return null;
      return { code: stripStyleInjector(code), map: null };
    },
  };
}
