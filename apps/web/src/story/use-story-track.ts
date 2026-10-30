/**
 * The story recording (`track` in story.json) as the reader's clock: one audio element plays the whole story, and the
 * pages follow its time instead of page timers, so the story goes on scene after scene when the page is hidden or the
 * phone is locked. The reader's own moves (next, previous, a scene from the list, play again) seek the recording.
 */
import { type StoryTrack, trackSceneAt } from '@truyen/story';
import { type Dispatch, type RefObject, type SyntheticEvent, useCallback, useLayoutEffect, useRef, useState } from 'react';
import type { PlayerAction, PlayerState } from './player-state';

/** Where the recording starts when the reader opens a scene: the very start for the first (its music lead-in), else the scene's voice. */
export function trackSeekTime(track: StoryTrack, index: number): number {
  return index <= 0 ? 0 : (track.scenes[index]?.start ?? 0);
}

export interface StoryTrackClock {
  /** The audio element that plays the recording. */
  ref: RefObject<HTMLAudioElement | null>;
  /** Seconds into the recording, as last reported by the audio element. */
  time: number;
  onTimeUpdate: (event: SyntheticEvent<HTMLAudioElement>) => void;
  onEnded: () => void;
}

interface Options {
  track: StoryTrack | undefined;
  state: PlayerState;
  dispatch: Dispatch<PlayerAction>;
  /** Off: the book waits on the scene's last line when its voice ends, as without the recording. */
  autoTurn: boolean;
  /** Called on every time report, which keeps coming while the page is hidden (the sleep timer checks itself here). */
  onTick?: () => void;
}

export function useStoryTrack({ track, state, dispatch, autoTurn, onTick }: Options): StoryTrackClock {
  const audio = useRef<HTMLAudioElement>(null);
  const [time, setTime] = useState(0);
  const latest = useRef({ state, autoTurn, onTick });
  // A scene change the recording made itself: the page follows it and nothing is sought.
  const following = useRef(false);
  useLayoutEffect(() => {
    latest.current = { state, autoTurn, onTick };
  });

  // Each scene start the reader asked for (a new `run`) moves the recording there.
  useLayoutEffect(() => {
    if (following.current) {
      following.current = false;
      return;
    }
    const element = audio.current;
    const { state: now } = latest.current;
    if (!element || !track || now.status === 'ended') return;
    element.currentTime = trackSeekTime(track, now.index);
  }, [state.run, track]);

  const onTimeUpdate = useCallback(
    (event: SyntheticEvent<HTMLAudioElement>) => {
      const element = event.currentTarget;
      if (!track || element.seeking) return;
      const seconds = element.currentTime;
      setTime(seconds);
      const { state: now, autoTurn: turn, onTick: tick } = latest.current;
      tick?.();
      const at = trackSceneAt(track, seconds);
      if (at !== now.index) {
        following.current = true;
        dispatch({ type: 'trackAt', index: at });
        return;
      }
      const end = track.scenes[now.index]?.end ?? Number.POSITIVE_INFINITY;
      if (!turn && now.status === 'playing' && seconds >= end) dispatch({ type: 'sceneEnded', autoTurn: false });
    },
    [track, dispatch],
  );

  const onEnded = useCallback(() => dispatch({ type: 'finished' }), [dispatch]);
  return { ref: audio, time, onTimeUpdate, onEnded };
}
