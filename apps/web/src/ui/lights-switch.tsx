import type { ReactNode } from 'react';
import { useI18n } from '../i18n/i18n';
import { Icon } from './icons';
import { setLights, useLights } from './lights';

/** The moon button: turns the lights off (lamplit look) or back on. In the header and in the reader's bar. */
export function LightsSwitch({ className = 'icon-btn', dataId }: { className?: string; dataId: string }): ReactNode {
  const { t } = useI18n();
  const off = useLights() === 'off';
  const label = off ? t('lights.on') : t('lights.off');
  return (
    <button type="button" className={className} aria-pressed={off} aria-label={label} title={label} onClick={() => setLights(off ? 'on' : 'off')} data-id={dataId}>
      <Icon name={off ? 'sun' : 'moon'} />
    </button>
  );
}
