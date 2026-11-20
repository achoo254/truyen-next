import type { ReactNode } from 'react';
import { useI18n } from '../i18n/i18n';
import { Icon } from '../ui/icons';

/** Typing settles for this long before the list filters (and the URL follows). */
export const SEARCH_DEBOUNCE_MS = 120;

/** The search box of a shelf and of the home page: one look, one label, one hint. */
export function SearchField({ id, value, onChange, dataId }: { id: string; value: string; onChange: (value: string) => void; dataId: string }): ReactNode {
  const { t } = useI18n();
  return (
    <label className="search" htmlFor={id}>
      <Icon name="search" />
      <span className="sr-only">{t('library.search')}</span>
      <input
        id={id}
        className="search-input"
        type="search"
        value={value}
        placeholder={t('library.searchHint')}
        autoComplete="off"
        enterKeyHint="search"
        onChange={(event) => onChange(event.currentTarget.value)}
        data-id={dataId}
      />
    </label>
  );
}
