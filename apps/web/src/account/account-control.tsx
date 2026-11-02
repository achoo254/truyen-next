import { AccountMenu } from '@achoo254/app-shell';
import { type ReactNode, useState } from 'react';
import { IDP_ACCOUNT_URL, brand } from '../brand';
import { useI18n } from '../i18n/i18n';
import { HISTORY_PATH, MY_SHELF_PATH } from './personal-paths';
import { type SessionUser, returnPathOf, signInHref, signOut, useSession } from './session';

/** The signed-in account in place of the sign-in pill: the shared account menu, with this site's own pages first. */
function AccountButton({ user }: { user: SessionUser }): ReactNode {
  const { t, locale } = useI18n();
  const [signingOut, setSigningOut] = useState(false);

  async function onSignOut(): Promise<void> {
    setSigningOut(true);
    try {
      await signOut();
    } catch (error) {
      console.warn('sign-out failed', error instanceof Error ? error.message : typeof error);
    } finally {
      // A fresh page as a guest; the reading progress stays on this device as for any guest.
      window.location.assign('/');
    }
  }

  return (
    <AccountMenu
      user={user}
      locale={locale}
      domain={brand.primaryTenant.domain}
      idpAccountUrl={IDP_ACCOUNT_URL}
      entries={[
        [
          { label: t('account.myShelf'), dataId: 'account-menu-my-shelf', href: MY_SHELF_PATH },
          { label: t('account.history'), dataId: 'account-menu-history', href: HISTORY_PATH },
        ],
      ]}
      signOut={{ onClick: () => void onSignOut(), busy: signingOut }}
    />
  );
}

/**
 * The header's account control, as on every hoandat.com app: the "Đăng nhập" pill for a guest (to the hoandat.com
 * account and back to this page), the account menu once signed in, nothing where sign-in is not available (the
 * iPhone app, the API down). While the session loads the pill shows, so the header does not jump for most visitors.
 */
export function AccountControl({ path }: { path: string }): ReactNode {
  const { t, locale } = useI18n();
  const session = useSession();
  if (session.status === 'ready' && session.signedIn) return <AccountButton user={session.user} />;
  if (session.status === 'ready' && !session.signInAvailable) return null;
  return (
    <a className="pill pill-sign-in" href={signInHref(locale, returnPathOf(path, window.location.search))} rel="nofollow" data-id="header-sign-in">
      {t('layout.signIn')}
    </a>
  );
}
