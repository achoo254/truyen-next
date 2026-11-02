/** JSON calls to the site's own API (same origin, under /api and /auth; the session cookie goes along). */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
  ) {
    super(code);
    this.name = 'ApiError';
  }
}

async function errorCode(res: Response): Promise<string> {
  try {
    const body: unknown = await res.json();
    if (typeof body === 'object' && body !== null && 'error' in body && typeof body.error === 'string') return body.error;
  } catch {
    // Not JSON (nginx's page when the API is down): fall through.
  }
  return `http-${res.status}`;
}

export async function apiFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const headers = new Headers(init.headers);
  headers.set('Accept', 'application/json');
  if (init.body !== undefined) headers.set('Content-Type', 'application/json');
  const res = await fetch(path, { ...init, headers, credentials: 'same-origin' });
  if (!res.ok) throw new ApiError(res.status, await errorCode(res));
  return res;
}

/** The JSON body of an API answer, still unchecked: every caller validates it before use. */
export async function apiJson(path: string, init: RequestInit = {}): Promise<unknown> {
  const res = await apiFetch(path, init);
  return (await res.json()) as unknown;
}
