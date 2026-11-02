import { type ReactNode, useEffect, useState } from 'react';
import { useI18n } from '../i18n/i18n';
import { Icon } from '../ui/icons';
import { returnPathOf, signInHref, useSession } from './session';
import { loadShelf, setSaved, useShelf } from './shelf-store';

/**
 * "Lưu vào tủ truyện" on a story's page. Signed in: a button that saves the story, then reads "Đã lưu vào tủ" and
 * takes it off the shelf again. A guest: a link to sign in and come back here. Nothing where sign-in is not
 * available, nor while the session or the shelf is still loading (no button that changes its mind).
 */
export function SaveStoryButton({ slug, path }: { slug: string; path: string }): ReactNode {
  const { t, locale } = useI18n();
  const session = useSession();
  const shelf = useShelf();
  const signedIn = session.status === 'ready' && session.signedIn;
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (signedIn) loadShelf();
  }, [signedIn]);

  if (session.status === 'loading' || !session.signInAvailable) return null;
  if (!signedIn) {
    return (
      <a className="btn btn-secondary btn-large" href={signInHref(locale, returnPathOf(path, window.location.search))} rel="nofollow" data-id="story-save-sign-in">
        <Icon name="bookmark" />
        {t('save.signIn')}
      </a>
    );
  }
  if (shelf.status !== 'ready') return null;

  const saved = shelf.slugs.includes(slug);
  async function toggle(): Promise<void> {
    setBusy(true);
    setFailed(false);
    try {
      await setSaved(slug, !saved);
    } catch (error) {
      console.warn('shelf not changed', error instanceof Error ? error.message : typeof error);
      setFailed(true);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <button type="button" className="btn btn-secondary btn-large" data-saved={saved} disabled={busy} onClick={() => void toggle()} data-id="story-save">
        <Icon name={saved ? 'bookmarked' : 'bookmark'} />
        {t(saved ? 'save.saved' : 'save.add')}
      </button>
      {failed && (
        <p className="save-failed" role="alert" data-id="story-save-failed">
          {t('save.failed')}
        </p>
      )}
    </>
  );
}
