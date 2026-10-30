import { READING_SCENES, type ReadingSceneId } from '@truyen/story';
import type { ReactNode } from 'react';
import { useI18n } from '../i18n/i18n';
import { Icon } from '../ui/icons';
import { SceneSwatch, isPainted } from './scene-backdrop';

/**
 * "Bối cảnh": where the book lies while reading. Applies at once, behind the open sheet, and is kept per shelf.
 * A scene not painted yet says so: its swatch is the CSS sketch the reader sees until then.
 */
export function ScenePicker({ value, onChange, lightsOff }: { value: ReadingSceneId; onChange: (id: ReadingSceneId) => void; lightsOff: boolean }): ReactNode {
  const { t, locale } = useI18n();
  return (
    <div className="sheet-group" role="group" aria-labelledby="pref-scene-label">
      <span className="sheet-label" id="pref-scene-label">
        {t('reader.scene')}
      </span>
      <div className="scene-picker">
        {READING_SCENES.map((scene) => (
          <button key={scene.id} type="button" className="scene-pick" aria-pressed={scene.id === value} onClick={() => onChange(scene.id)} data-id={`pref-scene-${scene.id}`}>
            <SceneSwatch id={scene.id} lightsOff={lightsOff} />
            {scene.id === value && <Icon name="check" className="scene-pick-check" />}
            <span className="scene-pick-name">{scene.name[locale]}</span>
            {!isPainted(scene.id, lightsOff) && <span className="scene-pick-note">{t('reader.sceneSketch')}</span>}
          </button>
        ))}
      </div>
    </div>
  );
}
