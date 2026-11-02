import type { ReactNode } from 'react';
import { useI18n } from '../i18n/i18n';
import { useSession } from './session';

/** Under a page's lede, for a guest where sign-in is available: what signing in adds (reading itself needs none). */
export function SignInPitch(): ReactNode {
  const { t } = useI18n();
  const session = useSession();
  if (session.status !== 'ready' || session.signedIn || !session.signInAvailable) return null;
  return (
    <p className="hero-lede hero-pitch" data-id="sign-in-pitch">
      {t('account.pitch')}
    </p>
  );
}
