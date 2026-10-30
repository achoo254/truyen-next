import { writePreference } from '@achoo254/app-shell/preferences';
import type { ReactNode } from 'react';
import { BRAND_MARK_SRC, ECOSYSTEM_URL, brand } from '../brand';
import { LOCALES, type Locale, useI18n } from '../i18n/i18n';
import { useParentalGate } from '../native/parental-gate';
import { DOWNLOADS_PATH, IN_APP } from '../platform/app-build';
import { parseShelfPath } from '../story/story-api';
import { Icon } from '../ui/icons';
import { LightsSwitch } from '../ui/lights-switch';

/** Each language in its own words (never translated), and the short code the header pill shows. */
const LOCALE_NAMES: Record<Locale, string> = { vi: 'Tiếng Việt', en: 'English' };
const LOCALE_CODES: Record<Locale, string> = { vi: 'VI', en: 'EN' };

interface NavLink {
  href: string;
  label: string;
  dataId: string;
  current: boolean;
}

/**
 * The header's language pill. A pick is stored in the cookie every hoandat.com app reads (`hd_lang`), so the
 * other apps open in it too, then the page re-renders in it.
 */
function LanguageSwitch(): ReactNode {
  const { t, locale, setLocale } = useI18n();
  return (
    <fieldset className="lang-switch" data-id="lang-switch">
      <legend className="sr-only">{t('layout.language')}</legend>
      {LOCALES.map((option) => (
        <button
          key={option}
          type="button"
          className="lang-option"
          lang={option}
          title={LOCALE_NAMES[option]}
          aria-pressed={option === locale}
          data-id={`lang-${option}`}
          onClick={() => {
            writePreference('lang', option, { domain: brand.primaryTenant.domain });
            setLocale(option);
          }}
        >
          <span aria-hidden="true">{LOCALE_CODES[option]}</span>
          <span className="sr-only">{LOCALE_NAMES[option]}</span>
        </button>
      ))}
    </fieldset>
  );
}

function SiteHeader({ navLinks }: { navLinks: NavLink[] }): ReactNode {
  const { t } = useI18n();
  return (
    <header className="topbar" data-id="public-header">
      <div className="topbar-inner container">
        <a className="brand" href="/" data-id="public-home">
          <img className="brand-mark" src={BRAND_MARK_SRC} width={32} height={32} alt="" aria-hidden="true" />
          <span className="brand-name">{brand.appName}</span>
        </a>
        <div className="topbar-end">
          <nav className="topbar-nav hide-phone" aria-label={t('layout.nav')}>
            {navLinks.map((link) => (
              <a key={link.dataId} className="pill" href={link.href} data-id={link.dataId} aria-current={link.current ? 'page' : undefined}>
                {link.label}
              </a>
            ))}
          </nav>
          {IN_APP && (
            <a className="icon-btn topbar-lights" href={DOWNLOADS_PATH} aria-label={t('layout.downloads')} data-id="header-downloads">
              <Icon name="download" />
            </a>
          )}
          <LightsSwitch className="icon-btn topbar-lights" dataId="header-lights" />
          <LanguageSwitch />
        </div>
      </div>
    </header>
  );
}

function SiteFooter({ path }: { path: string }): ReactNode {
  const { t } = useI18n();
  // In the app the ecosystem link leaves for the browser: a grown-up confirms first.
  const gate = useParentalGate(IN_APP);
  const domain = brand.primaryTenant.domain;
  const links: NavLink[] = [
    { href: '/privacy', label: t('layout.privacy'), dataId: 'foot-privacy', current: path === '/privacy' },
    { href: '/terms', label: t('layout.terms'), dataId: 'foot-terms', current: path === '/terms' },
    { href: '/credits', label: t('layout.credits'), dataId: 'foot-credits', current: path === '/credits' },
  ];
  return (
    <footer className="foot" data-id="public-footer">
      <div className="foot-inner container">
        <div className="foot-brand">
          <img className="foot-mark" src={BRAND_MARK_SRC} width={24} height={24} alt="" aria-hidden="true" loading="lazy" decoding="async" />
          <a
            className="foot-home"
            href={ECOSYSTEM_URL}
            data-id="foot-home"
            onClick={(event) => {
              if (!IN_APP) return;
              event.preventDefault();
              // The app hands any address off its own pages to Safari and stays where it is.
              gate.ask(() => window.location.assign(ECOSYSTEM_URL));
            }}
          >
            {t('layout.ecosystem', { domain })}
          </a>
          {gate.dialog}
        </div>
        <nav className="foot-links" aria-label={t('layout.footLinks')}>
          {links.map((link) => (
            <a key={link.dataId} className="foot-link" href={link.href} data-id={link.dataId} aria-current={link.current ? 'page' : undefined}>
              {link.label}
            </a>
          ))}
        </nav>
        <p className="foot-note" data-id="foot-note">
          {t('layout.note')}
        </p>
      </div>
    </footer>
  );
}

/**
 * Every page: the app's header (mark, name, links, language), the page body, and the footer (ecosystem link,
 * legal pages, note), in the same order as every hoandat.com app. No sign-in: reading needs no account.
 */
export function SitePage({ path, children }: { path: string; children: ReactNode }): ReactNode {
  const { t } = useI18n();
  const navLinks: NavLink[] = [{ href: '/', label: t('layout.stories'), dataId: 'nav-stories', current: path === '/' }];
  const shelf = parseShelfPath(path);
  return (
    <div className={shelf ? `site site--${shelf}` : 'site'}>
      <a className="skip-link" href="#main" data-id="skip-link">
        {t('layout.skip')}
      </a>
      <SiteHeader navLinks={navLinks} />
      {/* Focusable by the skip link only, not in the tab order. */}
      <main id="main" tabIndex={-1} className="main container">
        {children}
      </main>
      <SiteFooter path={path} />
    </div>
  );
}
