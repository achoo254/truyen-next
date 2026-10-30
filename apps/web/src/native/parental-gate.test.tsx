import { cleanup, fireEvent, render } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { I18nProvider } from '../i18n/i18n';
import { capitalise, gateAnswered, gateQuestion, gateWords, useParentalGate } from './parental-gate';

afterEach(cleanup);

function Probe({ gated, onGo }: { gated: boolean; onGo: () => void }): ReactNode {
  const { ask, dialog } = useParentalGate(gated);
  return (
    <>
      <button type="button" data-id="leave" onClick={() => ask(onGo)}>
        leave
      </button>
      {dialog}
    </>
  );
}

const q = (id: string): HTMLElement => {
  const element = document.querySelector<HTMLElement>(`[data-id=${id}]`);
  if (!element) throw new Error(`no [data-id=${id}]`);
  return element;
};

describe('parental gate', () => {
  it('asks a two-digit times-table question with the numbers in words', () => {
    expect(gateQuestion(() => 0)).toEqual({ a: 3, b: 3 });
    expect(gateQuestion(() => 0.9999)).toEqual({ a: 9, b: 9 });
    expect(gateWords({ a: 7, b: 6 }, 'vi')).toEqual({ a: 'bảy', b: 'sáu' });
    expect(gateWords({ a: 7, b: 6 }, 'en')).toEqual({ a: 'seven', b: 'six' });
    expect(gateAnswered({ a: 7, b: 6 }, ' 42 ')).toBe(true);
    expect(gateAnswered({ a: 7, b: 6 }, '41')).toBe(false);
    expect(gateAnswered({ a: 7, b: 6 }, '42abc')).toBe(false);
    expect(gateAnswered({ a: 7, b: 6 }, '')).toBe(false);
    expect(capitalise('chín nhân bảy bằng bao nhiêu?')).toBe('Chín nhân bảy bằng bao nhiêu?');
  });

  it('lets the action through only after the right answer, and asks again after a wrong one', () => {
    const onGo = vi.fn();
    render(
      <I18nProvider>
        <Probe gated onGo={onGo} />
      </I18nProvider>,
    );
    fireEvent.click(q('leave'));
    expect(onGo).not.toHaveBeenCalled();
    const product = (): string => {
      const match = /^(\S+) nhân (\S+) bằng/.exec((q('gate-question').textContent ?? '').toLowerCase());
      const words = ['', '', 'hai', 'ba', 'bốn', 'năm', 'sáu', 'bảy', 'tám', 'chín'];
      return String(words.indexOf(match?.[1] ?? '') * words.indexOf(match?.[2] ?? ''));
    };
    fireEvent.change(q('gate-answer'), { target: { value: '1' } });
    fireEvent.click(q('gate-go'));
    expect(onGo).not.toHaveBeenCalled();
    expect(q('gate-wrong')).toBeTruthy();
    fireEvent.change(q('gate-answer'), { target: { value: product() } });
    fireEvent.click(q('gate-go'));
    expect(onGo).toHaveBeenCalledTimes(1);
  });

  it('does nothing in the way on the web', () => {
    const onGo = vi.fn();
    render(
      <I18nProvider>
        <Probe gated={false} onGo={onGo} />
      </I18nProvider>,
    );
    fireEvent.click(q('leave'));
    expect(onGo).toHaveBeenCalledTimes(1);
    expect(document.querySelector('[data-id=parental-gate]')).toBeNull();
  });
});
