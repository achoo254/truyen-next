import { type ReactNode, useState } from 'react';
import { useI18n } from '../i18n/i18n';
import { loginResultOf } from './session';

/** What the server said when a sign-in did not open a session (`?login=` on the page it sent the reader back to). */
export function LoginNotice(): ReactNode {
  const { t } = useI18n();
  const [result, setResult] = useState(() => loginResultOf(window.location.search));
  if (result === null) return null;
  return (
    <div className="card notice login-notice" role="status" data-id="login-notice">
      <p>{t(`login.${result}`)}</p>
      <button type="button" className="btn btn-ghost" onClick={() => setResult(null)} data-id="login-notice-dismiss">
        {t('login.dismiss')}
      </button>
    </div>
  );
}
