import type { Story } from '@truyen/story';
import type { ReactNode } from 'react';
import { useI18n } from '../i18n/i18n';
import { SheetDialog } from '../ui/sheet-dialog';

interface SceneIndexProps {
  story: Story;
  current: number;
  open: boolean;
  onClose: () => void;
  onPick: (index: number) => void;
}

/** "Các cảnh": every scene by number and title; a tap opens the story at that scene. */
export function SceneIndex({ story, current, open, onClose, onPick }: SceneIndexProps): ReactNode {
  const { t } = useI18n();
  return (
    <SheetDialog open={open} onClose={onClose} title={t('story.progress')} dataId="scene-index">
      <ol className="scene-list">
        {story.scenes.map((scene, index) => (
          <li key={scene.id}>
            <button
              type="button"
              className="scene-list-item"
              aria-current={index === current ? 'step' : undefined}
              onClick={() => {
                onPick(index);
                onClose();
              }}
              data-id={`scene-index-${index + 1}`}
            >
              <span className="scene-list-number">{index + 1}</span>
              <span className="scene-list-title" lang="vi">
                {scene.title}
              </span>
            </button>
          </li>
        ))}
      </ol>
    </SheetDialog>
  );
}
