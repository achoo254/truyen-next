/**
 * Who is reading: a hoandat.com account signed in through the site's API (apps/server, BFF: the session is an
 * httpOnly cookie the page never sees), or a guest. Reading never waits for this; only the personal features
 * (saved stories, progress on every device, history) use it. The iPhone app has no API next to its pages, so there
 * sign-in is simply not available.
 */
import { IN_APP } from '../platform/app-build';
import { createStore, useStoreValue } from '../ui/external-store';
import { isRecord } from '../ui/local-store';
import { apiFetch, apiJson } from './api-client';

/** The signed-in account as the IdP named it at the latest sign-in; any field may be null. */
export interface SessionUser {
  name: string | null;
  email: string | null;
  picture: string | null;
}

export type SessionState =
  | { status: 'loading' }
  | { status: 'ready'; signedIn: false; signInAvailable: boolean }
  | { status: 'ready'; signedIn: true; signInAvailable: true; user: SessionUser };

/** Sign-in is not set up (or the API cannot be reached): the site works as it always did, with no sign-in button. */
export const SIGN_IN_UNAVAILABLE: SessionState = { status: 'ready', signedIn: false, signInAvailable: false };

const nullableText = (value: unknown): string | null => (typeof value === 'string' ? value : null);

/** The answer of GET /api/session, or null when it is not one. */
export function parseSession(body: unknown): SessionState | null {
  if (!isRecord(body) || typeof body.signedIn !== 'boolean' || typeof body.signInAvailable !== 'boolean') return null;
  if (!body.signedIn) return { status: 'ready', signedIn: false, signInAvailable: body.signInAvailable };
  if (!isRecord(body.user)) return null;
  const { name, email, picture } = body.user;
  return { status: 'ready', signedIn: true, signInAvailable: true, user: { name: nullableText(name), email: nullableText(email), picture: nullableText(picture) } };
}

/** Before anyone asked the API; `loadSession` then moves on to a second loading state while the answer comes. */
export const SESSION_NOT_ASKED: SessionState = { status: 'loading' };
const SESSION_ASKED: SessionState = { status: 'loading' };

/** The session of this page view, shared by the header, the story page and the progress sync. */
export const sessionStore = createStore<SessionState>(IN_APP ? SIGN_IN_UNAVAILABLE : SESSION_NOT_ASKED);

/** Asks the API once per page view; an unreachable API or an odd answer counts as "sign-in unavailable". */
export function loadSession(): void {
  if (sessionStore.get() !== SESSION_NOT_ASKED) return;
  sessionStore.set(SESSION_ASKED);
  apiJson('/api/session').then(
    (body) => {
      const session = parseSession(body);
      if (!session) console.warn('session answer not understood');
      sessionStore.set(session ?? SIGN_IN_UNAVAILABLE);
    },
    (error: unknown) => {
      console.warn('session unavailable', error instanceof Error ? error.message : typeof error);
      sessionStore.set(SIGN_IN_UNAVAILABLE);
    },
  );
}

export function useSession(): SessionState {
  return useStoreValue(sessionStore);
}

/** True once the page knows an account is signed in. */
export function isSignedIn(): boolean {
  const session = sessionStore.get();
  return session.status === 'ready' && session.signedIn;
}

/** The paths sign-in may come back to: this site only, as the server checks (apps/server oidc-login.ts). */
export function safeReturnPath(value: string): string {
  if (!value.startsWith('/') || value.startsWith('//') || value.includes('\\') || value.length > 200) return '/';
  return value;
}

/** The page to come back to after signing in: this one, without a previous sign-in notice. */
export function returnPathOf(path: string, search: string): string {
  const query = new URLSearchParams(search);
  query.delete('login');
  const rest = query.toString();
  return rest ? `${path}?${rest}` : path;
}

/** The server's sign-in route: to the hoandat.com account in `locale`, then back to `returnTo` on this site. */
export function signInHref(locale: string, returnTo: string): string {
  return `/auth/login?${new URLSearchParams({ return: safeReturnPath(returnTo), lang: locale }).toString()}`;
}

/** Ends the session on the server (the cookie is httpOnly, so only the server can drop it). */
export async function signOut(): Promise<void> {
  await apiFetch('/auth/logout', { method: 'POST' });
}

/** What a failed or refused sign-in left in the address (`?login=`), for a notice on the page it came back to. */
export type LoginResult = 'fail' | 'unavailable' | 'busy';

export function loginResultOf(search: string): LoginResult | null {
  const value = new URLSearchParams(search).get('login');
  return value === 'fail' || value === 'unavailable' || value === 'busy' ? value : null;
}
