import { describe, expect, it } from 'vitest';
import { contrastRatio, findColourLiterals, mixHex, parseTokens, parseThemes } from './token-contrast';

describe('token checks', () => {
  it('computes WCAG contrast ratios', () => {
    expect(contrastRatio('#000000', '#ffffff')).toBeCloseTo(21, 5);
    expect(contrastRatio('#ffffff', '#ffffff')).toBe(1);
    expect(contrastRatio('#767676', '#ffffff')).toBeCloseTo(4.54, 2);
  });

  it('mixes colours like color-mix in srgb', () => {
    expect(mixHex('#ffffff', '#000000', 0.5)).toBe('#808080');
    expect(mixHex('#ffffff', '#d9c7e1', 1)).toBe('#ffffff');
  });

  it('reads every custom property of the token file, comments left out', () => {
    const tokens = parseTokens(`/* --x: #000000; */ :root { --a: #111111; --b: url("data:image/svg+xml,%3Csvg fill='%23fff'%3E"); }
      @media (min-width: 768px) { :root { --gap: 24px; } }`);
    expect(tokens.get('--a')).toBe('#111111');
    expect(tokens.get('--b')).toBe(`url("data:image/svg+xml,%3Csvg fill='%23fff'%3E")`);
    expect(tokens.get('--gap')).toBe('24px');
    expect(tokens.has('--x')).toBe(false);
  });

  it('finds colour literals with their line', () => {
    expect(findColourLiterals('a\ncolor: #fff;\nfill: rgb(0 0 0)\n&#123; id="#main"', 'x.css')).toEqual([
      { file: 'x.css', line: 2, match: '#fff' },
      { file: 'x.css', line: 3, match: 'rgb(' },
    ]);
  });
});

describe('looks', () => {
  it('reads the light look and lays the lamplit look over it', () => {
    const css = `:root { --a: #ffffff; --b: #000000; /* :root[data-theme='dark'] { --a: #111111; } */ }
:root[data-theme="dark"] { --a: #222222; }
.x { --a: #333333; }`;
    const themes = parseThemes(css);
    expect(themes.get('light')?.get('--a')).toBe('#ffffff');
    expect(themes.get('dark')?.get('--a')).toBe('#222222');
    expect(themes.get('dark')?.get('--b')).toBe('#000000');
  });

  it('fails when a look is missing', () => {
    expect(() => parseThemes(':root { --a: #ffffff; }')).toThrow(/data-theme/);
  });
});
