/**
 * The reader's sleep timer: when the picked minutes run out (or the story reaches its end, for "at the end"), the page
 * dims and every sound of the reader fades for SLEEP_FADE_MS, then the story pauses. It checks itself on a page timer
 * and, while a story recording plays, on each of the recording's time reports (`tick`), which keep coming while the
 * phone is locked and page timers are held back. iOS keeps a media element's volume at full (WebKit ignores
 * `volume` there), so on an iPhone the sound stops at the end of the fade without fading.
 */
import { type RefObject, useCallback, useEffect, useRef, useState } from 'react';
import type { PlayStatus } from './player-state';
import { fadeShare, minutesLeft, type SleepOption, sleepDeadline } from './sleep-timer';

/** Music sits under the voice; the sleep timer fades it from this level, and waking restores it. */
export const MUSIC_VOLUME = 0.25;

type Phase = 'awake' | 'fading' | 'asleep';

/** The level an audio element of the reader plays at when awake: the looped music under the voice, anything else full. */
const fullVolume = (audio: HTMLAudioElement): number => (audio.loop ? MUSIC_VOLUME : 1);

export interface Sleep {
  option: SleepOption;
  pick: (option: SleepOption) => void;
  phase: Phase;
  wake: () => void;
  minutesLeft: number | null;
  /** Checks the timer now (called by the story recording's time reports). */
  tick: () => void;
}

export function useSleep(status: PlayStatus, pause: () => void, reader: RefObject<HTMLElement | null>): Sleep {
  const [option, setOption] = useState<SleepOption>('off');
  const [deadline, setDeadline] = useState<number | null>(null);
  const [phase, setPhase] = useState<Phase>('awake');
  const [now, setNow] = useState(() => Date.now());
  const clock = useRef<{ deadline: number | null; phase: Phase; fadeStart: number }>({ deadline: null, phase: 'awake', fadeStart: 0 });
  const pauseRef = useRef(pause);
  useEffect(() => {
    pauseRef.current = pause;
  }, [pause]);

  const setVolumes = useCallback(
    (share: number) => {
      for (const audio of reader.current?.querySelectorAll('audio') ?? []) audio.volume = share * fullVolume(audio);
    },
    [reader],
  );

  const enter = useCallback((next: Phase, at: number) => {
    clock.current = { ...clock.current, phase: next, fadeStart: next === 'fading' ? at : clock.current.fadeStart };
    setPhase(next);
  }, []);

  /** One step of the timer: runs out into the fade, turns the sound down, and pauses at the end of the fade. */
  const tick = useCallback(() => {
    const at = Date.now();
    const current = clock.current;
    if (current.phase === 'awake') {
      setNow(at);
      if (current.deadline !== null && at >= current.deadline) enter('fading', at);
      return;
    }
    if (current.phase !== 'fading') return;
    const share = fadeShare(current.fadeStart, at);
    setVolumes(share);
    if (share <= 0) {
      pauseRef.current();
      enter('asleep', at);
    }
  }, [enter, setVolumes]);

  const pick = useCallback(
    (next: SleepOption) => {
      const at = Date.now();
      const until = sleepDeadline(next, at);
      clock.current = { deadline: until, phase: 'awake', fadeStart: 0 };
      setOption(next);
      setDeadline(until);
      setNow(at);
      setPhase('awake');
    },
    [],
  );

  // The page timer: once a second while the minutes count down, four times a second while fading.
  useEffect(() => {
    if (phase === 'asleep' || (phase === 'awake' && deadline === null)) return undefined;
    const id = window.setInterval(tick, phase === 'fading' ? 250 : 1000);
    return () => window.clearInterval(id);
  }, [deadline, phase, tick]);

  const wake = useCallback(() => {
    setVolumes(1);
    clock.current = { deadline: null, phase: 'awake', fadeStart: 0 };
    setOption('off');
    setDeadline(null);
    setPhase('awake');
  }, [setVolumes]);

  // "At the end of the story": the last page is reached, nothing to fade (the story has stopped by itself).
  const shown = option === 'end' && status === 'ended' && phase === 'awake' ? 'asleep' : phase;
  return { option, pick, phase: shown, wake, minutesLeft: deadline === null ? null : minutesLeft(deadline, now), tick };
}
