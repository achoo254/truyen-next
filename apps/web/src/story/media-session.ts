/**
 * The Media Session API: what the lock screen, the notification shade and the headset show and control while the story
 * recording plays (story title, scene, picture; play, pause, previous and next scene, seeking). Browsers without it
 * (and tests) get nothing; the reader works the same.
 */
import { useEffect, useRef } from 'react';

export interface NowPlaying {
  /** The scene, e.g. "Cảnh 2 · Vua và công chúa". */
  title: string;
  /** The story. */
  artist: string;
  /** The app. */
  album: string;
  /** Absolute URL of a picture: the scene's still, else the app icon. */
  artwork: string;
}

export interface MediaControls {
  play: () => void;
  pause: () => void;
  previous: () => void;
  next: () => void;
  /** Moves the recording to `seconds`. */
  seekTo: (seconds: number) => void;
  /** Where the recording is now, for the relative seeks. */
  position: () => number;
}

/** How far the headset's and lock screen's skip buttons jump when they skip by time. */
export const SEEK_STEP_SECONDS = 10;

function session(): MediaSession | null {
  return typeof navigator !== 'undefined' && 'mediaSession' in navigator && typeof MediaMetadata === 'function' ? navigator.mediaSession : null;
}

/** The picture's type for the lock screen, from its file name. */
function artworkType(url: string): string {
  if (url.endsWith('.webp')) return 'image/webp';
  if (url.endsWith('.svg')) return 'image/svg+xml';
  return 'image/png';
}

/** Tells the lock screen how long the recording is and where it is; a browser that refuses the numbers is ignored. */
export function reportPosition(audio: HTMLMediaElement): void {
  const media = session();
  if (!media || typeof media.setPositionState !== 'function' || !Number.isFinite(audio.duration) || audio.duration <= 0) return;
  try {
    media.setPositionState({ duration: audio.duration, playbackRate: audio.playbackRate || 1, position: Math.min(audio.currentTime, audio.duration) });
  } catch (error) {
    console.warn('media position refused', error instanceof Error ? error.name : typeof error);
  }
}

/**
 * Shows `info` on the lock screen and answers its buttons while `enabled` (the reader plays a story recording). Cleared
 * when the reader closes.
 */
export function useMediaSession(enabled: boolean, info: NowPlaying, playing: boolean, controls: MediaControls): void {
  const latest = useRef(controls);
  useEffect(() => {
    latest.current = controls;
  });

  useEffect(() => {
    const media = session();
    if (!media || !enabled) return undefined;
    const handlers: [MediaSessionAction, MediaSessionActionHandler][] = [
      ['play', () => latest.current.play()],
      ['pause', () => latest.current.pause()],
      ['previoustrack', () => latest.current.previous()],
      ['nexttrack', () => latest.current.next()],
      ['seekto', (details) => {
        if (typeof details.seekTime === 'number') latest.current.seekTo(details.seekTime);
      }],
      ['seekbackward', (details) => latest.current.seekTo(latest.current.position() - (details.seekOffset ?? SEEK_STEP_SECONDS))],
      ['seekforward', (details) => latest.current.seekTo(latest.current.position() + (details.seekOffset ?? SEEK_STEP_SECONDS))],
    ];
    for (const [action, handler] of handlers) {
      try {
        media.setActionHandler(action, handler);
      } catch {
        // An action this browser does not know (older Safari: seekto); the others still work.
      }
    }
    return () => {
      for (const [action] of handlers) {
        try {
          media.setActionHandler(action, null);
        } catch {
          // Not registered above either.
        }
      }
      media.metadata = null;
      media.playbackState = 'none';
    };
  }, [enabled]);

  const { title, artist, album, artwork } = info;
  useEffect(() => {
    const media = session();
    if (!media || !enabled) return;
    media.metadata = new MediaMetadata({ title, artist, album, artwork: [{ src: artwork, type: artworkType(artwork) }] });
  }, [enabled, title, artist, album, artwork]);

  useEffect(() => {
    const media = session();
    if (media && enabled) media.playbackState = playing ? 'playing' : 'paused';
  }, [enabled, playing]);
}
