import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { describe, expect, it } from 'vitest';
import { PAGE_FLIP_MODULE, stripStyleInjector } from './vite-page-flip';

const moduleCode = readFileSync(createRequire(import.meta.url).resolve(PAGE_FLIP_MODULE), 'utf8');

describe('page-flip without its inline style', () => {
  it('drops the <style> injector from the pinned build and keeps the library', () => {
    expect(moduleCode).toContain('createElement("style")');
    const stripped = stripStyleInjector(moduleCode);
    expect(stripped).not.toContain('createElement("style")');
    expect(stripped).not.toContain('.stf__parent {');
    expect(stripped).toMatch(/export\{\w+ as PageFlip\};\s*$/);
    expect(moduleCode.length - stripped.length).toBeLessThan(2000);
  });

  it('refuses a build without the injector, so a version change cannot slip through', () => {
    expect(() => stripStyleInjector('export{x as PageFlip};')).toThrow(/expected one style injector/);
  });
});
