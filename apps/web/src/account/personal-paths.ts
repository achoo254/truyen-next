/** The signed-in reader's own pages. Never indexed: they differ per account and say nothing to a search engine. */
export const MY_SHELF_PATH = '/tu-truyen';
export const HISTORY_PATH = '/lich-su';

export type PersonalPage = 'my-shelf' | 'history';

export function parsePersonalPath(path: string): PersonalPage | null {
  if (path === MY_SHELF_PATH) return 'my-shelf';
  if (path === HISTORY_PATH) return 'history';
  return null;
}
