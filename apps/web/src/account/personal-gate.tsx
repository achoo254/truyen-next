import type { ReactNode } from 'react';
import { brand } from '../brand';
import { useI18n } from '../i18n/i18n';
import { returnPathOf, signInHref, useSession } from './session';

/**
 * The body of a page that needs an account: a quiet wait while the session loads, a card inviting a guest to sign in
 * (reading itself needs none), a plain notice when sign-in is not available, and the page itself once signed in.
 */
export function PersonalGate({ path, children }: { path: string; children: ReactNode }): ReactNode {
  const { t, locale } = useI18n();
  const session = useSession();
  const domain = brand.primaryTenant.domain;
  if (session.status === 'loading') {
    return (
      <div className="tile-grid tile-grid--skeleton" role="status" data-id="personal-loading">
        <span className="sr-only">{t('personal.loading')}</span>
      </div>
    );
  }
  if (session.signedIn) return children;
  if (!session.signInAvailable) {
    return (
      <div className="card" role="status" data-id="personal-unavailable">
        <p>{t('personal.unavailable')}</p>
      </div>
    );
  }
  return (
    <div className="card sign-in-card" data-id="personal-sign-in">
      <p>{t('personal.lead', { domain })}</p>
      <a className="btn btn-primary" href={signInHref(locale, returnPathOf(path, window.location.search))} rel="nofollow" data-id="personal-sign-in-button">
        {t('personal.cta', { domain })}
      </a>
    </div>
  );
}
