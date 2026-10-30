import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { App, routePath } from './app';
import { brand } from './brand';
import { I18nProvider } from './i18n/i18n';
import { parseStoryPath, storyPath } from './story/story-api';

function clearPreferences(): void {
  document.cookie = 'hd_lang=; Max-Age=0; Path=/';
  window.localStorage.clear();
}

beforeEach(() => {
  clearPreferences();
  vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify([]), { status: 200 })));
});
afterEach(() => {
  cleanup();
  clearPreferences();
  vi.unstubAllGlobals();
});

function show(path: string): void {
  render(
    <I18nProvider>
      <App pathname={path} />
    </I18nProvider>,
  );
}

describe('routes', () => {
  it('normalises paths and reads story slugs', () => {
    expect(routePath('/credits/')).toBe('/credits');
    expect(routePath('/')).toBe('/');
    expect(storyPath('son-tinh-thuy-tinh')).toBe('/truyen/son-tinh-thuy-tinh');
    expect(parseStoryPath('/truyen/son-tinh-thuy-tinh')).toBe('son-tinh-thuy-tinh');
    for (const path of ['/truyen/', '/truyen/../x', '/truyen/A', '/x']) expect(parseStoryPath(path)).toBeNull();
  });

  it('frames every page with the header (name, link, language) and the footer (ecosystem, legal pages)', async () => {
    show('/');
    expect(document.querySelector('[data-id=public-home]')?.textContent).toBe(brand.appName);
    expect(document.querySelector('[data-id=nav-stories]')?.getAttribute('aria-current')).toBe('page');
    expect(document.querySelector('[data-id=lang-vi]')?.getAttribute('aria-pressed')).toBe('true');
    expect(document.querySelector('[data-id=skip-link]')?.getAttribute('href')).toBe('#main');
    expect(document.querySelector('main#main')).not.toBeNull();
    expect([...document.querySelectorAll('[data-id=public-footer] .foot-link:not(.only-phone)')].map((a) => a.getAttribute('href'))).toEqual(['/privacy', '/terms', '/credits']);
    expect(document.querySelector('[data-id=foot-home]')?.getAttribute('href')).toBe('https://hoandat.com');
    expect(document.querySelector('[data-id=sign-in], [data-id=public-sign-in]')).toBeNull();
    expect(await screen.findByText('Chưa có câu chuyện nào.')).toBeTruthy();
  });

  it('switches the language and stores the shared choice', () => {
    show('/credits');
    fireEvent.click(screen.getByRole('button', { name: 'English' }));
    expect(document.querySelector('h1')?.textContent).toBe('Credits');
    expect(document.cookie).toContain('hd_lang=en');
    expect(document.querySelector('[data-id=legal-credits]')?.textContent).toContain('AI-generated for the hoandat ecosystem; owned by hoandat, all rights reserved (not CC0)');
  });

  it('shows the not-found page for an unknown path and a missing story', async () => {
    show('/khong-co');
    expect(document.querySelector('[data-id=not-found]')).not.toBeNull();
    cleanup();
    vi.stubGlobal('fetch', vi.fn(async () => new Response('not found', { status: 404 })));
    show('/truyen/khong-co');
    expect(await screen.findByText('Không tìm thấy câu chuyện này.')).toBeTruthy();
  });
});
