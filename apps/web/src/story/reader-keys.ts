/** What a key press means in the reader, or null when the reader leaves it alone. Pure, so it is tested as a table. */
export type ReaderKeyAction = 'next' | 'prev' | 'toggle' | 'mute' | 'close';

export interface KeyPress {
  key: string;
  altKey: boolean;
  ctrlKey: boolean;
  metaKey: boolean;
  shiftKey: boolean;
  /** What has the focus: a button or link presses on Space; a field (or a dialog's list) keeps every key. */
  focus: 'none' | 'button' | 'field';
}

export function readerKeyAction(press: KeyPress): ReaderKeyAction | null {
  if (press.altKey || press.ctrlKey || press.metaKey) return null;
  if (press.focus === 'field') return press.key === 'Escape' ? 'close' : null;
  switch (press.key) {
    case 'ArrowRight':
    case 'PageDown':
      return 'next';
    case 'ArrowLeft':
    case 'PageUp':
      return 'prev';
    case ' ':
      // Space on a focused button presses that button.
      return press.focus === 'button' ? null : 'toggle';
    case 'm':
    case 'M':
      return 'mute';
    case 'Escape':
      return 'close';
    default:
      return null;
  }
}

export function focusKind(target: EventTarget | null): KeyPress['focus'] {
  if (!(target instanceof Element)) return 'none';
  if (target.closest('input, select, textarea, dialog')) return 'field';
  return target.closest('button, a, summary') ? 'button' : 'none';
}
