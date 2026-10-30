import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { StoryListEntry } from '@truyen/story';
import pilotJson from '../../../stories/son-tinh-thuy-tinh/story.json';
import adultJson from '../../../stories/su-tich-ho-guom/story.json';
import { App, routePath } from './app';
import { brand } from './brand';
import { I18nProvider } from './i18n/i18n';
import { parseShelfPath, parseStoryPath, shelfPath, storyPath } from './story/story-api';

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

const LIST: StoryListEntry[] = [
  { slug: 'thanh-giong', shelf: 'kids', title: 'Thánh Gióng', summary: 'Cậu bé Gióng.', scenes: 9, minutes: 6, themes: ['anh-hung'], added: '2026-10-30' },
  { slug: 'su-tich-ho-guom', shelf: 'adults', title: 'Sự tích Hồ Gươm', summary: 'Rùa Vàng.', scenes: 11, minutes: 7, themes: ['anh-hung', 'su-tich'], added: '2026-10-30' },
  { slug: 'son-tinh-thuy-tinh', shelf: 'kids', title: 'Sơn Tinh, Thủy Tinh', summary: 'Hai vị thần.', scenes: 8, minutes: 4, themes: ['than-thoai'], added: '2026-10-29' },
];

function stubList(list: unknown): void {
  vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify(list), { status: 200 })));
}

function cardsOf(shelf: string): (string | null)[] {
  return [...document.querySelectorAll(`[data-id=story-list-${shelf}] > li`)].map((li) => li.getAttribute('data-id'));
}

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
    expect(shelfPath('kids')).toBe('/tre-em');
    expect(shelfPath('adults')).toBe('/nguoi-lon');
    expect(parseShelfPath('/tre-em')).toBe('kids');
    expect(parseShelfPath(routePath('/nguoi-lon/'))).toBe('adults');
    expect(parseShelfPath('/x')).toBeNull();
  });

  it('frames every page with the header (name, link, language) and the footer (ecosystem, legal pages)', async () => {
    show('/');
    expect(document.querySelector('[data-id=public-home]')?.textContent).toBe(brand.appName);
    expect(document.querySelector('[data-id=nav-stories]')?.getAttribute('aria-current')).toBe('page');
    expect(document.querySelector('[data-id=lang-vi]')?.getAttribute('aria-pressed')).toBe('true');
    expect(document.querySelector('[data-id=skip-link]')?.getAttribute('href')).toBe('#main');
    expect(document.querySelector('main#main')).not.toBeNull();
    expect([...document.querySelectorAll('[data-id=public-footer] .foot-link')].map((a) => a.getAttribute('href'))).toEqual(['/privacy', '/terms', '/credits']);
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

  it('shows both shelves on the home page, children first, each story on its own shelf', async () => {
    stubList(LIST);
    show('/');
    await screen.findByText('Thánh Gióng');
    const shelves = [...document.querySelectorAll('[data-id^=shelf-]:is(section)')].map((section) => section.getAttribute('data-id'));
    expect(shelves).toEqual(['shelf-kids', 'shelf-adults']);
    expect(cardsOf('kids')).toEqual(['story-card-thanh-giong', 'story-card-son-tinh-thuy-tinh']);
    expect(cardsOf('adults')).toEqual(['story-card-su-tich-ho-guom']);
    expect(document.querySelector('[data-id=shelf-open-kids]')?.getAttribute('href')).toBe('/tre-em');
    expect(document.querySelector('[data-id=shelf-open-adults]')?.getAttribute('href')).toBe('/nguoi-lon');
    expect(document.querySelector('[data-id=story-open-thanh-giong]')?.getAttribute('href')).toBe('/truyen/thanh-giong');
    // Each shelf wears its own look: brighter for children, ink for adults.
    expect(document.querySelector('[data-id=shelf-kids]')?.classList.contains('theme-kids')).toBe(true);
    expect(document.querySelector('[data-id=shelf-adults]')?.classList.contains('theme-adults')).toBe(true);
    expect(document.querySelector('[data-id=home-hero] img')?.getAttribute('alt')).toBe('');
  });

  it('opens the children\'s shelf alone at /tre-em, with a way to all stories', async () => {
    stubList(LIST);
    show('/tre-em');
    await screen.findByText('Thánh Gióng');
    expect(document.querySelector('h1')?.textContent).toBe('Cổ tích Việt Nam cho bé');
    expect(document.title).toMatch(/^Cổ tích Việt Nam cho bé · /);
    expect(cardsOf('kids')).toEqual(['story-card-thanh-giong', 'story-card-son-tinh-thuy-tinh']);
    expect(document.querySelector('[data-id=shelf-adults]')).toBeNull();
    expect(screen.queryByText('Sự tích Hồ Gươm')).toBeNull();
    expect(document.querySelector('[data-id=shelf-all]')?.getAttribute('href')).toBe('/');
    expect(document.querySelector('[data-id^=shelf-open-]')).toBeNull();
  });

  it('says so when a shelf has no story yet', async () => {
    stubList(LIST.filter((entry) => entry.shelf === 'kids'));
    show('/nguoi-lon');
    expect(await screen.findByText('Kệ này chưa có câu chuyện nào.')).toBeTruthy();
  });

  it('rejects a story list entry without a known shelf', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    stubList([{ ...LIST[0], shelf: 'teens' }]);
    show('/');
    expect(await screen.findByRole('alert')).toBeTruthy();
    expect(consoleError).toHaveBeenCalled();
    consoleError.mockRestore();
  });

  it.each([
    ['son-tinh-thuy-tinh', pilotJson, 'Kệ Trẻ em', '/tre-em', 'Về kệ Trẻ em'],
    ['su-tich-ho-guom', adultJson, 'Kệ Người lớn', '/nguoi-lon', 'Về kệ Người lớn'],
  ])('shows the shelf of the story %s and leads back to it', async (slug, json, label, href, back) => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify(json), { status: 200 })));
    show(`/truyen/${slug}`);
    expect((await screen.findByText(label)).getAttribute('data-id')).toBe('story-shelf');
    const backLink = document.querySelector('[data-id=story-back]');
    expect(backLink?.getAttribute('href')).toBe(href);
    expect(backLink?.textContent).toBe(back);
    expect(document.querySelector('[data-id=story-page]')?.classList.contains(href === '/tre-em' ? 'theme-kids' : 'theme-adults')).toBe(true);
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
