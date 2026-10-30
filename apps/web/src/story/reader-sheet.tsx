import type { ReactNode } from 'react';
import { type MessageKey } from '../i18n/messages';
import { useI18n } from '../i18n/i18n';
import { Icon } from '../ui/icons';
import { setLights, useLights } from '../ui/lights';
import { SheetDialog } from '../ui/sheet-dialog';
import { RATES, type Rate, type ReaderPrefs, TEXT_SIZES, type TextSize } from './reader-prefs';
import { SLEEP_OPTIONS, type SleepOption } from './sleep-timer';

/** An on/off row: the label, and a switch that says its state. */
function SwitchRow({ label, on, onChange, dataId }: { label: string; on: boolean; onChange: (on: boolean) => void; dataId: string }): ReactNode {
  return (
    <div className="sheet-row">
      <span className="sheet-label" id={`${dataId}-label`}>
        {label}
      </span>
      <button type="button" role="switch" className="switch" aria-checked={on} aria-labelledby={`${dataId}-label`} onClick={() => onChange(!on)} data-id={dataId}>
        <span className="switch-thumb" />
      </button>
    </div>
  );
}

/** A choice of a few options, side by side; the chosen one is pressed. */
function Choice<T extends string | number>({
  label,
  options,
  value,
  onChange,
  name,
  dataId,
}: {
  label: string;
  options: readonly T[];
  value: T;
  onChange: (value: T) => void;
  name: (option: T) => string;
  dataId: string;
}): ReactNode {
  return (
    <div className="sheet-group" role="group" aria-labelledby={`${dataId}-label`}>
      <span className="sheet-label" id={`${dataId}-label`}>
        {label}
      </span>
      <div className="segmented">
        {options.map((option) => (
          <button key={String(option)} type="button" className="segment" aria-pressed={option === value} onClick={() => onChange(option)} data-id={`${dataId}-${String(option)}`}>
            {name(option)}
          </button>
        ))}
      </div>
    </div>
  );
}

const TEXT_SIZE_NAMES: Record<TextSize, MessageKey> = { s: 'reader.textSmall', m: 'reader.textMedium', l: 'reader.textLarge' };

export interface ReaderSheetProps {
  open: boolean;
  onClose: () => void;
  prefs: ReaderPrefs;
  onPrefs: (change: Partial<ReaderPrefs>) => void;
  hasVoice: boolean;
  hasSound: boolean;
  muted: boolean;
  onToggleMute: () => void;
  sleep: SleepOption;
  sleepMinutesLeft: number | null;
  onSleep: (option: SleepOption) => void;
  fullscreen: { supported: boolean; on: boolean; toggle: () => void };
  onShare: () => void;
  shareNote: string | null;
  onScenes: () => void;
  /** More rows from the caller (the reading scene picker). */
  children?: ReactNode;
}

/** "Tuỳ chọn": everything the reader can change, kept off the page so a child does not press it by mistake. */
export function ReaderSheet(props: ReaderSheetProps): ReactNode {
  const { t } = useI18n();
  const lightsOff = useLights() === 'off';
  const { prefs, onPrefs } = props;
  const rateName = (rate: Rate): string => `${String(rate).replace('.', t('reader.decimal'))}×`;
  const sleepName = (option: SleepOption): string =>
    option === 'off' ? t('reader.sleepOff') : option === 'end' ? t('reader.sleepEnd') : t('home.minutes', { minutes: option });
  return (
    <SheetDialog open={props.open} onClose={props.onClose} title={t('reader.options')} dataId="reader-sheet">
      <div className="sheet-body">
        <SwitchRow label={t('lights.off')} on={lightsOff} onChange={(off) => setLights(off ? 'off' : 'on')} dataId="pref-lights" />
        <SwitchRow label={t('reader.autoTurn')} on={prefs.autoTurn} onChange={(autoTurn) => onPrefs({ autoTurn })} dataId="pref-auto-turn" />
        <Choice label={t('reader.sleep')} options={SLEEP_OPTIONS} value={props.sleep} onChange={props.onSleep} name={sleepName} dataId="pref-sleep" />
        {props.sleepMinutesLeft !== null && (
          <p className="sheet-note" role="status">
            {t('reader.sleepLeft', { minutes: props.sleepMinutesLeft })}
          </p>
        )}
        <Choice label={t('reader.textSize')} options={TEXT_SIZES} value={prefs.textSize} onChange={(textSize) => onPrefs({ textSize })} name={(size) => t(TEXT_SIZE_NAMES[size])} dataId="pref-text" />
        <Choice label={t('reader.rate')} options={RATES} value={prefs.rate} onChange={(rate) => onPrefs({ rate })} name={rateName} dataId="pref-rate" />
        {/* Subtitles always show while there is no voice to follow instead. */}
        {props.hasVoice && <SwitchRow label={t('reader.subtitles')} on={prefs.subtitles} onChange={(subtitles) => onPrefs({ subtitles })} dataId="pref-subtitles" />}
        {props.hasSound && <SwitchRow label={t('story.mute')} on={props.muted} onChange={props.onToggleMute} dataId="pref-mute" />}
        {props.children}
        <div className="sheet-actions">
          <button type="button" className="btn btn-secondary" onClick={props.onScenes} data-id="reader-scenes">
            <Icon name="scenes" />
            {t('story.progress')}
          </button>
          {props.fullscreen.supported && (
            <button type="button" className="btn btn-secondary" aria-pressed={props.fullscreen.on} onClick={props.fullscreen.toggle} data-id="reader-fullscreen">
              <Icon name={props.fullscreen.on ? 'shrink' : 'expand'} />
              {props.fullscreen.on ? t('reader.fullscreenOff') : t('reader.fullscreen')}
            </button>
          )}
          <button type="button" className="btn btn-secondary" onClick={props.onShare} data-id="reader-share">
            <Icon name="share" />
            {t('reader.share')}
          </button>
        </div>
        {props.shareNote && (
          <p className="sheet-note" role="status" data-id="reader-share-note">
            {props.shareNote}
          </p>
        )}
      </div>
    </SheetDialog>
  );
}
