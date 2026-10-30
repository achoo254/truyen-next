import { describe, expect, it } from 'vitest';
import { type KeyPress, readerKeyAction } from './reader-keys';

const press = (key: string, extra: Partial<KeyPress> = {}): KeyPress => ({ key, altKey: false, ctrlKey: false, metaKey: false, shiftKey: false, focus: 'none', ...extra });

describe('reader keys', () => {
  it('turns pages with the arrows and page keys', () => {
    expect(readerKeyAction(press('ArrowRight'))).toBe('next');
    expect(readerKeyAction(press('PageDown'))).toBe('next');
    expect(readerKeyAction(press('ArrowLeft'))).toBe('prev');
    expect(readerKeyAction(press('PageUp'))).toBe('prev');
    expect(readerKeyAction(press('ArrowRight', { focus: 'button' }))).toBe('next');
  });

  it('plays or pauses on Space unless a button has the focus', () => {
    expect(readerKeyAction(press(' '))).toBe('toggle');
    expect(readerKeyAction(press(' ', { focus: 'button' }))).toBeNull();
  });

  it('mutes on M, closes on Escape, and leaves shortcuts and fields alone', () => {
    expect(readerKeyAction(press('m'))).toBe('mute');
    expect(readerKeyAction(press('M', { shiftKey: true }))).toBe('mute');
    expect(readerKeyAction(press('Escape'))).toBe('close');
    expect(readerKeyAction(press('ArrowRight', { metaKey: true }))).toBeNull();
    expect(readerKeyAction(press('ArrowLeft', { altKey: true }))).toBeNull();
    expect(readerKeyAction(press('ArrowRight', { focus: 'field' }))).toBeNull();
    expect(readerKeyAction(press('Escape', { focus: 'field' }))).toBe('close');
    expect(readerKeyAction(press('a'))).toBeNull();
  });
});
