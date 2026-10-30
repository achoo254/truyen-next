import { readFileSync } from 'node:fs';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { LIGHTS_KEY, currentLights, savedLights, setLights } from './lights';

afterEach(() => {
  window.localStorage.clear();
  document.documentElement.removeAttribute('data-theme');
});

describe('lights', () => {
  it('stores the choice in its own key and sets the look on the page', () => {
    setLights('off');
    expect(window.localStorage.getItem(LIGHTS_KEY)).toBe('off');
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
    expect(currentLights()).toBe('off');
    setLights('on');
    expect(savedLights()).toBe('on');
    expect(document.documentElement.getAttribute('data-theme')).toBe('light');
  });

  it('never writes the shared theme cookie', () => {
    setLights('off');
    expect(document.cookie).not.toMatch(/hd_theme/);
  });

  it('ignores anything else stored under the key', () => {
    window.localStorage.setItem(LIGHTS_KEY, 'dim');
    expect(savedLights()).toBeNull();
  });

  it('agrees with the pre-paint script on the key and its values', () => {
    const script = readFileSync(path.resolve(__dirname, '../../public/theme-init.js'), 'utf8');
    expect(script).toContain(`'${LIGHTS_KEY}'`);
    expect(script).toContain("saved === 'off'");
    expect(script).toContain("saved !== 'on'");
  });
});
