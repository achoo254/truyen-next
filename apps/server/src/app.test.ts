import { sql } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { type FakeIdp, startFakeIdp } from '../test/fake-idp';
import { api, cookieFrom, location, signIn } from '../test/sign-in';
import { type TestServer, startTestServer } from '../test/test-server';
import { HISTORY_LIMIT, type ReadingEntry } from './reading/reading-store';

const CLIENT_ID = 'truyen-web';
const SECRET = 'test-secret-'.padEnd(40, 'x');
const PROFILE_A = { name: 'Nguyễn Văn A', email: 'a@example.com', picture: 'https://lh3.googleusercontent.com/a/photo' };

type Json = Record<string, unknown>;
const json = async (res: Response): Promise<Json> => (await res.json()) as Json;

async function shelfSlugs(server: TestServer, cookie: string): Promise<string[]> {
  const body = (await json(await api(server, '/api/shelf', { cookie }))) as { stories: Array<{ slug: string }> };
  return body.stories.map((story) => story.slug);
}

async function postReading(server: TestServer, cookie: string, entries: ReadingEntry[]): Promise<ReadingEntry[]> {
  const res = await api(server, '/api/reading', { method: 'POST', cookie, body: JSON.stringify({ entries }) });
  expect(res.status).toBe(200);
  return ((await res.json()) as { entries: ReadingEntry[] }).entries;
}

describe('without sign-in configured', () => {
  let server: TestServer;
  beforeAll(async () => {
    server = await startTestServer();
  });
  afterAll(async () => {
    await server.close();
  });

  it('answers the health check', async () => {
    const res = await fetch(`${server.origin}/healthz`);
    expect(res.status).toBe(200);
    expect(await res.text()).toBe('ok');
  });

  it('reports sign-in as unavailable and sends /auth/login back with a notice', async () => {
    expect(await json(await fetch(`${server.origin}/api/session`))).toEqual({ signedIn: false, signInAvailable: false });
    const res = await fetch(`${server.origin}/auth/login?return=/truyen/tam-cam`, { redirect: 'manual' });
    expect(location(res)).toBe('/truyen/tam-cam?login=unavailable');
  });

  it('keeps the shelf and the reading progress behind sign-in', async () => {
    for (const [path, method] of [
      ['/api/shelf', 'GET'],
      ['/api/shelf/tam-cam', 'PUT'],
      ['/api/shelf/tam-cam', 'DELETE'],
      ['/api/reading', 'GET'],
    ] as const) {
      const res = await api(server, path, { method });
      expect(res.status, `${method} ${path}`).toBe(401);
      expect(await res.json()).toEqual({ error: 'sign-in-required' });
    }
    const post = await api(server, '/api/reading', { method: 'POST', body: JSON.stringify({ entries: [] }) });
    expect(post.status).toBe(401);
  });

  it('answers unknown API paths with a JSON 404', async () => {
    const res = await fetch(`${server.origin}/api/nope`);
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: 'not-found' });
  });
});

describe('signed in through the hoandat.com account', () => {
  let idp: FakeIdp;
  let server: TestServer;

  beforeAll(async () => {
    idp = await startFakeIdp({ clientId: CLIENT_ID, clientSecret: SECRET, sub: 'account-a', profile: PROFILE_A });
    server = await startTestServer({ AUTH_ISSUER: idp.issuer, AUTH_CLIENT_SECRET: SECRET });
  });
  afterAll(async () => {
    await server.close();
    await idp.close();
  });

  /** Signs `sub` in and puts the fake IdP back on account A. */
  async function signInAs(sub: string): Promise<string> {
    idp.setSub(sub);
    try {
      return await signIn(server);
    } finally {
      idp.setSub('account-a');
    }
  }

  it('opens a session from Code + PKCE and ends it on logout', async () => {
    const session = await signIn(server);
    expect(session).toMatch(/^truyen_session=[A-Za-z0-9_-]{43}$/);
    expect(await json(await api(server, '/api/session', { cookie: session }))).toEqual({
      signedIn: true,
      signInAvailable: true,
      user: { name: 'Nguyễn Văn A', email: 'a@example.com', picture: 'https://lh3.googleusercontent.com/a/photo' },
    });
    const logout = await api(server, '/auth/logout', { method: 'POST', cookie: session });
    expect(logout.status).toBe(204);
    expect(await json(await api(server, '/api/session', { cookie: session }))).toMatchObject({ signedIn: false });
    expect((await api(server, '/api/shelf', { cookie: session })).status).toBe(401);
  });

  it('asks the IdP in the page language and comes back to the story the reader was on', async () => {
    const start = await fetch(`${server.origin}/auth/login?return=/truyen/tam-cam&lang=en`, { redirect: 'manual' });
    const authorize = new URL(location(start));
    expect(authorize.searchParams.get('client_id')).toBe(CLIENT_ID);
    expect(authorize.searchParams.get('ui_locales')).toBe('en');
    expect(authorize.searchParams.get('redirect_uri')).toBe(`${server.origin}/auth/callback`);
    const consent = await fetch(authorize, { redirect: 'manual' });
    const callback = await fetch(location(consent), { redirect: 'manual', headers: { cookie: cookieFrom(start, 'truyen_login') } });
    expect(location(callback)).toBe('/truyen/tam-cam');
  });

  it('never returns to another site after signing in', async () => {
    const start = await fetch(`${server.origin}/auth/login?return=//evil.example/x`, { redirect: 'manual' });
    const consent = await fetch(location(start), { redirect: 'manual' });
    const callback = await fetch(location(consent), { redirect: 'manual', headers: { cookie: cookieFrom(start, 'truyen_login') } });
    expect(location(callback)).toBe('/');
  });

  it('rejects a callback without the login cookie or with another state', async () => {
    const start = await fetch(`${server.origin}/auth/login`, { redirect: 'manual' });
    const consent = await fetch(location(start), { redirect: 'manual' });
    const noCookie = await fetch(location(consent), { redirect: 'manual' });
    expect(location(noCookie)).toBe('/?login=fail');
    expect(noCookie.headers.getSetCookie().some((c) => c.startsWith('truyen_session='))).toBe(false);

    const again = await fetch(`${server.origin}/auth/login`, { redirect: 'manual' });
    const wrongState = new URL(location(await fetch(location(again), { redirect: 'manual' })));
    wrongState.searchParams.set('state', 'forged');
    const forged = await fetch(wrongState, { redirect: 'manual', headers: { cookie: cookieFrom(again, 'truyen_login') } });
    expect(location(forged)).toBe('/?login=fail');
  });

  it('saves stories to the shelf, newest first, and takes them off; both are idempotent', async () => {
    const session = await signInAs('account-shelf');
    expect(await shelfSlugs(server, session)).toEqual([]);
    for (const slug of ['tam-cam', 'son-tinh-thuy-tinh', 'tam-cam']) {
      expect((await api(server, `/api/shelf/${slug}`, { method: 'PUT', cookie: session })).status).toBe(204);
    }
    expect(await shelfSlugs(server, session)).toEqual(['son-tinh-thuy-tinh', 'tam-cam']);
    expect((await api(server, '/api/shelf/tam-cam', { method: 'DELETE', cookie: session })).status).toBe(204);
    expect((await api(server, '/api/shelf/tam-cam', { method: 'DELETE', cookie: session })).status).toBe(204);
    expect(await shelfSlugs(server, session)).toEqual(['son-tinh-thuy-tinh']);
  });

  it('refuses slugs that are not a story address', async () => {
    const session = await signIn(server);
    for (const slug of ['Tam-Cam', 'tam--cam', '-tam', 'a'.repeat(101), 'tam%20cam']) {
      const res = await api(server, `/api/shelf/${slug}`, { method: 'PUT', cookie: session });
      expect(res.status, slug).toBe(400);
      expect(await res.json()).toEqual({ error: 'invalid-slug' });
    }
  });

  it('keeps the newer record of each story, whichever device sends it', async () => {
    const session = await signInAs('account-progress');
    const t = Date.now() - 60_000;
    // Phone: two stories in the middle.
    expect(await postReading(server, session, [
      { slug: 'tam-cam', index: 4, at: t },
      { slug: 'cay-khe', index: 2, at: t + 1000 },
    ])).toEqual([
      { slug: 'cay-khe', index: 2, at: t + 1000 },
      { slug: 'tam-cam', index: 4, at: t },
    ]);
    // Laptop, opened later: it read Tấm Cám further, but its Cây khế record is older than the phone's.
    const merged = await postReading(server, session, [
      { slug: 'tam-cam', index: 7, at: t + 5000 },
      { slug: 'cay-khe', index: 1, at: t + 500 },
    ]);
    expect(merged).toEqual([
      { slug: 'tam-cam', index: 7, at: t + 5000 },
      { slug: 'cay-khe', index: 2, at: t + 1000 },
    ]);
    // Reading Cây khế to the end on the phone leaves "nothing to continue", which wins over the older scene.
    await postReading(server, session, [{ slug: 'cay-khe', index: 0, at: t + 6000 }]);
    const after = (await json(await api(server, '/api/reading', { cookie: session }))) as { entries: ReadingEntry[] };
    expect(after.entries).toEqual([
      { slug: 'cay-khe', index: 0, at: t + 6000 },
      { slug: 'tam-cam', index: 7, at: t + 5000 },
    ]);
  });

  it('counts a clock running ahead as now, and the newest of repeated entries in one request', async () => {
    const session = await signInAs('account-clock');
    const before = Date.now();
    const [entry] = await postReading(server, session, [
      { slug: 'tam-cam', index: 3, at: before + 365 * 24 * 3600_000 },
      { slug: 'tam-cam', index: 2, at: before - 1000 },
    ]);
    expect(entry?.index).toBe(3);
    expect(entry?.at).toBeLessThanOrEqual(Date.now());
    expect(entry?.at).toBeGreaterThanOrEqual(before);
    // A later honest record still replaces it.
    const [next] = await postReading(server, session, [{ slug: 'tam-cam', index: 5, at: Date.now() + 10 }]);
    expect(next?.index).toBe(5);
  });

  it(`keeps the ${HISTORY_LIMIT} most recent stories`, async () => {
    const session = await signInAs('account-history');
    const t = Date.now() - 1_000_000;
    const all: ReadingEntry[] = Array.from({ length: HISTORY_LIMIT + 20 }, (_, i) => ({ slug: `truyen-${i}`, index: 1, at: t + i }));
    await postReading(server, session, all.slice(0, 100));
    await postReading(server, session, all.slice(100, 200));
    const kept = await postReading(server, session, all.slice(200));
    expect(kept).toHaveLength(HISTORY_LIMIT);
    expect(kept[0]?.slug).toBe(`truyen-${HISTORY_LIMIT + 19}`);
    expect(kept.some((entry) => entry.slug === 'truyen-0')).toBe(false);
  });

  it('rejects malformed reading bodies', async () => {
    const session = await signIn(server);
    const post = (body: unknown): Promise<Response> => api(server, '/api/reading', { method: 'POST', cookie: session, body: JSON.stringify(body) });
    const good = { slug: 'tam-cam', index: 1, at: Date.now() };
    for (const body of [
      {},
      { entries: 'x' },
      { entries: [{ ...good, index: -1 }] },
      { entries: [{ ...good, index: 1.5 }] },
      { entries: [{ ...good, slug: 'Tam Cam' }] },
      { entries: [{ ...good, extra: true }] },
      { entries: Array.from({ length: 101 }, (_, i) => ({ ...good, slug: `s-${i}` })) },
    ]) {
      const res = await post(body);
      expect(res.status, JSON.stringify(body).slice(0, 60)).toBe(400);
    }
    const malformed = await api(server, '/api/reading', { method: 'POST', cookie: session, body: '{' });
    expect(malformed.status).toBe(400);
    expect(await malformed.json()).toEqual({ error: 'invalid-body' });
  });

  it("never shows or changes another account's shelf or progress", async () => {
    const a = await signInAs('account-owner');
    const b = await signInAs('account-other');
    await api(server, '/api/shelf/tam-cam', { method: 'PUT', cookie: a });
    await postReading(server, a, [{ slug: 'tam-cam', index: 6, at: Date.now() - 1000 }]);

    expect(await shelfSlugs(server, b)).toEqual([]);
    expect(await json(await api(server, '/api/reading', { cookie: b }))).toEqual({ entries: [] });
    // B's writes stay B's.
    await api(server, '/api/shelf/tam-cam', { method: 'DELETE', cookie: b });
    await postReading(server, b, [{ slug: 'tam-cam', index: 1, at: Date.now() }]);

    expect(await shelfSlugs(server, a)).toEqual(['tam-cam']);
    const aReading = (await json(await api(server, '/api/reading', { cookie: a }))) as { entries: ReadingEntry[] };
    expect(aReading.entries.map((entry) => entry.index)).toEqual([6]);
  });

  it('refuses state changes from another origin (CSRF)', async () => {
    const session = await signIn(server);
    const crossSite = await fetch(`${server.origin}/api/shelf/tam-cam`, { method: 'PUT', headers: { cookie: session, origin: 'https://evil.example' } });
    expect(crossSite.status).toBe(403);
    const noOrigin = await fetch(`${server.origin}/auth/logout`, { method: 'POST', headers: { cookie: session } });
    expect(noOrigin.status).toBe(403);
    expect(await json(await api(server, '/api/session', { cookie: session }))).toMatchObject({ signedIn: true });
  });
});

describe('sign-in limits and session hygiene', () => {
  let idp: FakeIdp;
  let server: TestServer;

  beforeAll(async () => {
    idp = await startFakeIdp({ clientId: CLIENT_ID, clientSecret: SECRET, sub: 'account-c' });
    server = await startTestServer({ AUTH_ISSUER: idp.issuer, AUTH_CLIENT_SECRET: SECRET }, { signInLimitPer15Min: 3 });
  });
  afterAll(async () => {
    await server.close();
    await idp.close();
  });

  it('replaces the browser’s previous session when it signs in again', async () => {
    const first = await signIn(server);
    const start = await fetch(`${server.origin}/auth/login?return=/saved`, { redirect: 'manual' });
    const consent = await fetch(location(start), { redirect: 'manual' });
    const callback = await fetch(location(consent), { redirect: 'manual', headers: { cookie: `${cookieFrom(start, 'truyen_login')}; ${first}` } });
    const second = cookieFrom(callback, 'truyen_session');
    expect(second).not.toBe(first);
    expect(await json(await api(server, '/api/session', { cookie: first }))).toMatchObject({ signedIn: false });
    expect(await json(await api(server, '/api/session', { cookie: second }))).toMatchObject({ signedIn: true });
  });

  it('sends a start over the limit back to the page with a notice, not a bare 429', async () => {
    // Two starts were used above (limit 3 per window).
    expect((await fetch(`${server.origin}/auth/login?return=/`, { redirect: 'manual' })).status).toBe(302);
    const over = await fetch(`${server.origin}/auth/login?return=/tre-em`, { redirect: 'manual' });
    expect(over.status).toBe(302);
    expect(location(over)).toBe('/tre-em?login=busy');
  });
});

describe('logging a failed query', () => {
  let idp: FakeIdp;
  let server: TestServer;

  beforeAll(async () => {
    idp = await startFakeIdp({ clientId: CLIENT_ID, clientSecret: SECRET, sub: 'account-d' });
    server = await startTestServer({ AUTH_ISSUER: idp.issuer, AUTH_CLIENT_SECRET: SECRET });
  });
  afterAll(async () => {
    await server.close();
    await idp.close();
  });

  it('never writes which story an account read to the log', async () => {
    const session = await signIn(server);
    await server.database.db.execute(sql`alter table reading_progress rename column scene_index to scene_index_broken`);
    const logged: string[] = [];
    const spy = vi.spyOn(console, 'error').mockImplementation((...args: unknown[]) => {
      logged.push(args.map(String).join(' '));
    });
    try {
      const res = await api(server, '/api/reading', { method: 'POST', cookie: session, body: JSON.stringify({ entries: [{ slug: 'su-tich-bi-mat', index: 3, at: Date.now() }] }) });
      expect(res.status).toBe(500);
      expect(await res.json()).toEqual({ error: 'internal' });
    } finally {
      spy.mockRestore();
    }
    const text = logged.join('\n');
    expect(text).toContain('request failed');
    expect(text).toContain('query failed');
    expect(text).not.toContain('su-tich-bi-mat');
  });
});
