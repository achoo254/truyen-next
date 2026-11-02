import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { StoryListEntry } from '@truyen/story';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import pilotJson from '../../../../stories/son-tinh-thuy-tinh/story.json';
import { App } from '../app';
import { I18nProvider } from '../i18n/i18n';
import { continueHref, historyItems } from '../pages/history-page';
import { savedEntries } from '../pages/my-shelf-page';
import { saveProgress } from '../story/reading-progress';
import { SESSION_NOT_ASKED, type SessionState, loadSession, loginResultOf, parseSession, returnPathOf, safeReturnPath, sessionStore, signInHref } from './session';
import { shelfStore } from './shelf-store';

const USER = { name: 'Nguyễn Văn A', email: 'a@example.com', picture: null };
const SIGNED_IN: SessionState = { status: 'ready', signedIn: true, signInAvailable: true, user: USER };
const GUEST: SessionState = { status: 'ready', signedIn: false, signInAvailable: true };
const UNAVAILABLE: SessionState = { status: 'ready', signedIn: false, signInAvailable: false };

const LIST: StoryListEntry[] = [
  { slug: 'son-tinh-thuy-tinh', shelf: 'kids', title: 'Sơn Tinh, Thủy Tinh', summary: 'Hai vị thần.', basedOn: 'Truyện dân gian Việt Nam', scenes: 8, minutes: 4, themes: ['than-thoai'], added: '2026-10-29' },
  { slug: 'su-tich-ho-guom', shelf: 'adults', title: 'Sự tích Hồ Gươm', summary: 'Rùa Vàng.', basedOn: 'Truyện dân gian Việt Nam', scenes: 11, minutes: 7, themes: ['su-tich'], added: '2026-10-30' },
];

type Handler = (init: RequestInit | undefined) => Response | Promise<Response>;
const json = (body: unknown, status = 200): Response => new Response(JSON.stringify(body), { status });

/** Answers fetch by address (method + path, or path alone), records every call; anything else is a 404. */
function routes(table: Record<string, Handler>): Array<{ method: string; path: string }> {
  const calls: Array<{ method: string; path: string }> = [];
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: string, init?: RequestInit) => {
      const path = String(input);
      const method = init?.method ?? 'GET';
      calls.push({ method, path });
      const handler = table[`${method} ${path}`] ?? table[path];
      return handler ? handler(init) : new Response('not found', { status: 404 });
    }),
  );
  return calls;
}

function show(path: string): void {
  window.history.replaceState(null, '', path);
  render(
    <I18nProvider>
      <App pathname={new URL(path, 'http://x.invalid').pathname} />
    </I18nProvider>,
  );
}

beforeEach(() => {
  window.localStorage.clear();
  document.cookie = 'hd_lang=; Max-Age=0; Path=/';
});
afterEach(() => {
  cleanup();
  sessionStore.set(SESSION_NOT_ASKED);
  shelfStore.set({ status: 'idle' });
  window.localStorage.clear();
  window.history.replaceState(null, '', '/');
  document.querySelector('meta[name="robots"]')?.remove();
  vi.unstubAllGlobals();
});

describe('session', () => {
  it('reads the API answer and refuses anything else', () => {
    expect(parseSession({ signedIn: false, signInAvailable: true })).toEqual(GUEST);
    expect(parseSession({ signedIn: true, signInAvailable: true, user: { name: 'A', email: 7, picture: null } })).toEqual({
      ...SIGNED_IN,
      user: { name: 'A', email: null, picture: null },
    });
    expect(parseSession({ signedIn: true, signInAvailable: true })).toBeNull();
    expect(parseSession([])).toBeNull();
    expect(parseSession({ signedIn: 'yes', signInAvailable: true })).toBeNull();
  });

  it('counts an API that cannot be reached as "sign-in unavailable", and asks only once', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const calls = routes({ '/api/session': () => new Response('<html>bad gateway</html>', { status: 502 }) });
    loadSession();
    loadSession();
    await vi.waitFor(() => expect(sessionStore.get()).toEqual(UNAVAILABLE));
    expect(calls).toHaveLength(1);
    warn.mockRestore();
  });

  it('only ever comes back to this site, in the page language, without an old sign-in notice', () => {
    expect(signInHref('en', '/truyen/tam-cam?canh=3')).toBe('/auth/login?return=%2Ftruyen%2Ftam-cam%3Fcanh%3D3&lang=en');
    for (const bad of ['//evil.example', 'https://evil.example', '/\\evil', `/${'x'.repeat(250)}`]) expect(safeReturnPath(bad)).toBe('/');
    expect(returnPathOf('/tre-em', '?login=fail&q=tam')).toBe('/tre-em?q=tam');
    expect(returnPathOf('/', '?login=busy')).toBe('/');
    expect(loginResultOf('?login=busy')).toBe('busy');
    expect(loginResultOf('?login=other')).toBeNull();
  });
});

describe('the header', () => {
  it('offers "Đăng nhập" to a guest, back to the page they are on', async () => {
    routes({ '/api/session': () => json({ signedIn: false, signInAvailable: true }), '/stories/index.json': () => json(LIST) });
    show('/tre-em');
    const pill = await screen.findByRole('link', { name: 'Đăng nhập' });
    expect(pill.getAttribute('href')).toBe('/auth/login?return=%2Ftre-em&lang=vi');
    expect(pill.getAttribute('data-id')).toBe('header-sign-in');
    expect(await screen.findByText(/Đăng nhập để lưu truyện yêu thích/)).toBeTruthy();
    // Reading needs none: the shelf is there all the same.
    expect(await screen.findByText('Sơn Tinh, Thủy Tinh')).toBeTruthy();
  });

  it('shows no sign-in where it is not available', async () => {
    routes({ '/api/session': () => json({ signedIn: false, signInAvailable: false }), '/stories/index.json': () => json(LIST) });
    show('/');
    await screen.findByText('Sơn Tinh, Thủy Tinh');
    await vi.waitFor(() => expect(sessionStore.get()).toEqual(UNAVAILABLE));
    expect(document.querySelector('[data-id=header-sign-in]')).toBeNull();
    expect(document.querySelector('[data-id=sign-in-pitch]')).toBeNull();
  });

  it('shows the account menu once signed in, with the shelf and the history', async () => {
    sessionStore.set(SIGNED_IN);
    routes({ '/stories/index.json': () => json(LIST), 'POST /api/reading': () => json({ entries: [] }) });
    show('/');
    expect(document.querySelector('[data-id=header-sign-in]')).toBeNull();
    expect(document.querySelector('[data-id=topbar-account]')?.getAttribute('aria-label')).toContain('Nguyễn Văn A');
    expect(document.querySelector('[data-id=account-menu-my-shelf]')?.getAttribute('href')).toBe('/tu-truyen');
    expect(document.querySelector('[data-id=account-menu-history]')?.getAttribute('href')).toBe('/lich-su');
  });

  it('says why a sign-in came back without a session', () => {
    sessionStore.set(GUEST);
    routes({});
    show('/credits?login=fail');
    expect(screen.getByRole('status').textContent).toContain('Đăng nhập chưa thành công');
    fireEvent.click(screen.getByRole('button', { name: 'Đóng thông báo' }));
    expect(document.querySelector('[data-id=login-notice]')).toBeNull();
  });
});

describe('saving a story', () => {
  it('asks a guest to sign in and come back to the story', async () => {
    sessionStore.set(GUEST);
    routes({ '/stories/son-tinh-thuy-tinh/story.json': () => json(pilotJson) });
    show('/truyen/son-tinh-thuy-tinh');
    const link = await screen.findByRole('link', { name: 'Đăng nhập để lưu truyện' });
    expect(link.getAttribute('href')).toBe('/auth/login?return=%2Ftruyen%2Fson-tinh-thuy-tinh&lang=vi');
  });

  it('saves to the shelf and takes off again for an account', async () => {
    sessionStore.set(SIGNED_IN);
    const calls = routes({
      '/stories/son-tinh-thuy-tinh/story.json': () => json(pilotJson),
      'GET /api/shelf': () => json({ stories: [] }),
      'PUT /api/shelf/son-tinh-thuy-tinh': () => new Response(null, { status: 204 }),
      'DELETE /api/shelf/son-tinh-thuy-tinh': () => new Response(null, { status: 204 }),
    });
    show('/truyen/son-tinh-thuy-tinh');
    fireEvent.click(await screen.findByRole('button', { name: 'Lưu vào tủ truyện' }));
    expect(await screen.findByRole('button', { name: 'Đã lưu vào tủ' })).toBeTruthy();
    expect(calls).toContainEqual({ method: 'PUT', path: '/api/shelf/son-tinh-thuy-tinh' });
    fireEvent.click(screen.getByRole('button', { name: 'Đã lưu vào tủ' }));
    expect(await screen.findByRole('button', { name: 'Lưu vào tủ truyện' })).toBeTruthy();
    expect(calls).toContainEqual({ method: 'DELETE', path: '/api/shelf/son-tinh-thuy-tinh' });
  });

  it('puts the button back and says so when the server refuses', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    sessionStore.set(SIGNED_IN);
    routes({
      '/stories/son-tinh-thuy-tinh/story.json': () => json(pilotJson),
      'GET /api/shelf': () => json({ stories: [] }),
      'PUT /api/shelf/son-tinh-thuy-tinh': () => json({ error: 'shelf-full' }, 409),
    });
    show('/truyen/son-tinh-thuy-tinh');
    fireEvent.click(await screen.findByRole('button', { name: 'Lưu vào tủ truyện' }));
    expect((await screen.findByRole('alert')).textContent).toBe('Chưa lưu được. Thử lại sau nhé.');
    expect(screen.getByRole('button', { name: 'Lưu vào tủ truyện' })).toBeTruthy();
    warn.mockRestore();
  });

  it('shows no save button where sign-in is not available', async () => {
    sessionStore.set(UNAVAILABLE);
    routes({ '/stories/son-tinh-thuy-tinh/story.json': () => json(pilotJson) });
    show('/truyen/son-tinh-thuy-tinh');
    await screen.findByRole('button', { name: /^(Đọc|Nghe) truyện$/ });
    expect(document.querySelector('[data-id^=story-save]')).toBeNull();
  });
});

describe('continue on any device', () => {
  it("offers to continue where the account's other device stopped, once synced", async () => {
    sessionStore.set(SIGNED_IN);
    const { startProgressSync } = await import('../story/progress-sync');
    routes({
      '/stories/son-tinh-thuy-tinh/story.json': () => json(pilotJson),
      'GET /api/shelf': () => json({ stories: [] }),
      'POST /api/reading': () => json({ entries: [{ slug: 'son-tinh-thuy-tinh', index: 4, at: Date.now() - 1000 }] }),
    });
    // This device had only opened the story long ago.
    saveProgress('son-tinh-thuy-tinh', 1, Date.now() - 86_400_000);
    show('/truyen/son-tinh-thuy-tinh');
    const stop = startProgressSync();
    expect(await screen.findByRole('button', { name: /cảnh 5$/ })).toBeTruthy();
    stop();
  });
});

describe('the reader’s own pages', () => {
  it('ask a guest to sign in, and are never indexed', async () => {
    sessionStore.set(GUEST);
    routes({});
    show('/tu-truyen');
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Tủ truyện của tôi');
    expect(document.querySelector('[data-id=personal-sign-in-button]')?.getAttribute('href')).toBe('/auth/login?return=%2Ftu-truyen&lang=vi');
    expect(document.querySelector('meta[name="robots"]')?.getAttribute('content')).toBe('noindex, nofollow');
    cleanup();
    show('/lich-su');
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Lịch sử đã đọc');
    expect(document.querySelector('[data-id=personal-sign-in]')).not.toBeNull();
  });

  it('list the saved stories, latest saved first', async () => {
    sessionStore.set(SIGNED_IN);
    routes({ '/stories/index.json': () => json(LIST), 'GET /api/shelf': () => json({ stories: [{ slug: 'su-tich-ho-guom' }, { slug: 'gone-story' }, { slug: 'son-tinh-thuy-tinh' }] }) });
    show('/tu-truyen');
    await screen.findByText('Sự tích Hồ Gươm');
    expect([...document.querySelectorAll('[data-id=my-shelf-list] > li')].map((li) => li.getAttribute('data-id'))).toEqual([
      'story-card-su-tich-ho-guom',
      'story-card-son-tinh-thuy-tinh',
    ]);
  });

  it('list the history, latest first, with "Đọc tiếp" where there is somewhere to continue', async () => {
    sessionStore.set(SIGNED_IN);
    const now = Date.now();
    routes({
      '/stories/index.json': () => json(LIST),
      'GET /api/reading': () => json({ entries: [{ slug: 'son-tinh-thuy-tinh', index: 3, at: now - 1000 }, { slug: 'su-tich-ho-guom', index: 0, at: now - 5000 }] }),
    });
    show('/lich-su');
    const resume = await screen.findByRole('link', { name: 'Đọc tiếp' });
    expect(resume.getAttribute('href')).toBe('/truyen/son-tinh-thuy-tinh?canh=4');
    expect(screen.getByText('Dừng ở cảnh 4/8')).toBeTruthy();
    expect(screen.getByText(/^Đọc ngày /)).toBeTruthy();
    expect([...document.querySelectorAll('[data-id=history-list] > li')].map((li) => li.getAttribute('data-id'))).toEqual(['history-item-son-tinh-thuy-tinh', 'history-item-su-tich-ho-guom']);
  });

  it('build their lists from the published stories only', () => {
    expect(savedEntries(['su-tich-ho-guom', 'nope'], LIST).map((entry) => entry.slug)).toEqual(['su-tich-ho-guom']);
    const items = historyItems(
      [
        { slug: 'su-tich-ho-guom', index: 20, at: 1 },
        { slug: 'nope', index: 2, at: 5 },
        { slug: 'son-tinh-thuy-tinh', index: 2, at: 3 },
      ],
      LIST,
    );
    expect(items.map(({ entry, resume }) => [entry.slug, resume])).toEqual([
      ['son-tinh-thuy-tinh', 2],
      ['su-tich-ho-guom', null],
    ]);
    expect(continueHref('tam-cam', 0)).toBe('/truyen/tam-cam?canh=1');
  });
});
