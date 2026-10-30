import { type ReactNode, useEffect, useId, useRef } from 'react';
import { useI18n } from '../i18n/i18n';
import { Icon } from './icons';

interface SheetDialogProps {
  open: boolean;
  onClose: () => void;
  title: string;
  dataId: string;
  children: ReactNode;
}

/**
 * A native modal <dialog> shown as a bottom sheet on phones and a side panel on wide screens: it traps the focus,
 * closes on Escape (the browser's own), on its × and on a tap outside it, and gives the focus back to what opened it.
 */
export function SheetDialog({ open, onClose, title, dataId, children }: SheetDialogProps): ReactNode {
  const { t } = useI18n();
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      // jsdom and very old browsers lack showModal: the open attribute still shows it.
      if (typeof dialog.showModal === 'function') dialog.showModal();
      else dialog.setAttribute('open', '');
    } else if (!open && dialog.open) {
      if (typeof dialog.close === 'function') dialog.close();
      else dialog.removeAttribute('open');
    }
  }, [open]);
  return (
    // A tap on the backdrop lands on the dialog itself; Escape is the keyboard way out (the browser's own).
    // eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-noninteractive-element-interactions
    <dialog
      ref={ref}
      className="sheet"
      aria-labelledby={titleId}
      data-id={dataId}
      onClose={onClose}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="sheet-inner">
        <header className="sheet-head">
          <h2 className="sheet-title" id={titleId}>
            {title}
          </h2>
          <button type="button" className="icon-btn icon-btn--flat" onClick={onClose} aria-label={t('sheet.close')} data-id={`${dataId}-close`}>
            <Icon name="close" />
          </button>
        </header>
        {children}
      </div>
    </dialog>
  );
}
