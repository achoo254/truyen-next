/**
 * The parental gate of the iPhone app: before anything leaves the app (a link to another site, the share sheet), a
 * grown-up answers a times-table question written in words, which a young child cannot read and work out. A wrong
 * answer brings a new question. On the web nothing is gated.
 */
import { type FormEvent, type ReactNode, useCallback, useId, useRef, useState } from 'react';
import type { Locale } from '../i18n/i18n';
import { useI18n } from '../i18n/i18n';
import { SheetDialog } from '../ui/sheet-dialog';

const NUMBER_WORDS: Record<Locale, readonly string[]> = {
  vi: ['', '', 'hai', 'ba', 'bốn', 'năm', 'sáu', 'bảy', 'tám', 'chín'],
  en: ['', '', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine'],
};

export interface GateQuestion {
  a: number;
  b: number;
}

/** Two factors from 3 to 9, so the answer has two digits. `random` is Math.random in the app. */
export function gateQuestion(random: () => number = Math.random): GateQuestion {
  const factor = (): number => 3 + Math.min(6, Math.floor(random() * 7));
  return { a: factor(), b: factor() };
}

/** Whether `answer` (what was typed) is the product; spaces around it are fine, nothing else. */
export function gateAnswered(question: GateQuestion, answer: string): boolean {
  return /^\d{1,3}$/.test(answer.trim()) && Number(answer.trim()) === question.a * question.b;
}

/** The question in the page language, its numbers as words. */
export function gateWords(question: GateQuestion, locale: Locale): { a: string; b: string } {
  const words = NUMBER_WORDS[locale];
  return { a: words[question.a] ?? String(question.a), b: words[question.b] ?? String(question.b) };
}

/** "chín nhân bảy…" → "Chín nhân bảy…": the question starts with a number word. */
export function capitalise(text: string): string {
  return text.charAt(0).toLocaleUpperCase('vi') + text.slice(1);
}

/**
 * `ask(action)` runs `action` once a grown-up has answered, or right away when `gated` is false (the web). Render
 * `dialog` once in the component.
 */
export function useParentalGate(gated: boolean): { ask: (action: () => void) => void; dialog: ReactNode } {
  const { t, locale } = useI18n();
  const [pending, setPending] = useState<(() => void) | null>(null);
  const [question, setQuestion] = useState<GateQuestion>(() => gateQuestion());
  const [answer, setAnswer] = useState('');
  const [wrong, setWrong] = useState(false);
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);

  const ask = useCallback(
    (action: () => void) => {
      if (!gated) {
        action();
        return;
      }
      setQuestion(gateQuestion());
      setAnswer('');
      setWrong(false);
      setPending(() => action);
    },
    [gated],
  );
  const close = useCallback(() => setPending(null), []);

  const submit = (event: FormEvent): void => {
    event.preventDefault();
    if (gateAnswered(question, answer)) {
      const action = pending;
      setPending(null);
      action?.();
      return;
    }
    setQuestion(gateQuestion());
    setAnswer('');
    setWrong(true);
    inputRef.current?.focus();
  };

  const words = gateWords(question, locale);
  const dialog = gated ? (
    <SheetDialog open={pending !== null} onClose={close} title={t('gate.title')} dataId="parental-gate">
      <form className="sheet-body gate" onSubmit={submit}>
        <p className="sheet-note">{t('gate.lede')}</p>
        <p className="gate-question" data-id="gate-question">
          {capitalise(t('gate.question', words))}
        </p>
        <label className="sheet-label" htmlFor={inputId}>
          {t('gate.answer')}
        </label>
        <input
          ref={inputRef}
          id={inputId}
          className="gate-input"
          inputMode="numeric"
          autoComplete="off"
          maxLength={3}
          value={answer}
          onChange={(event) => setAnswer(event.target.value)}
          data-id="gate-answer"
        />
        {wrong && (
          <p className="sheet-note" role="status" data-id="gate-wrong">
            {t('gate.wrong')}
          </p>
        )}
        <button type="submit" className="btn btn-primary" data-id="gate-go">
          {t('gate.go')}
        </button>
      </form>
    </SheetDialog>
  ) : null;
  return { ask, dialog };
}
