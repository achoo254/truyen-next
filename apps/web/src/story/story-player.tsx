import { MIN_SCENE_SECONDS, MIU_NARRATOR, type Scene, type Story, estimateReadingSeconds, subtitleIndexAt } from '@truyen/story';
import { type ReactNode, type RefObject, useCallback, useEffect, useReducer, useRef, useState } from 'react';
import { useI18n } from '../i18n/i18n';
import { Icon } from '../ui/icons';
import { EndPage } from './end-page';
import { type PlayStatus, type PlayerState, type TurnDirection, initialPlayerState, playerReducer } from './player-state';
import { focusKind, readerKeyAction } from './reader-keys';
import { preloadAfter, sceneMedia, storyFileUrl, storyHasNoMedia } from './scene-media';
import { useSceneTimer } from './use-scene-timer';
import { useSwipe } from './use-swipe';

/** Music sits under the voice. */
const MUSIC_VOLUME = 0.25;
/** Longest page turn (CSS: --turn-slow); the leaf is cleared after it even if no animation event arrives. */
const TURN_SAFETY_MS = 1200;

/** Plays or pauses a media element with the story; a refused play() (autoplay rules) is reported, not thrown. */
function useMediaPlayback(ref: RefObject<HTMLMediaElement | null>, playing: boolean, onRefused?: () => void): void {
  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    if (!playing) {
      element.pause();
      return;
    }
    element.play().catch((error: unknown) => {
      console.warn('media did not start', error instanceof Error ? error.name : typeof error);
      onRefused?.();
    });
  }, [ref, playing, onRefused]);
}

/** "Mèo Miu kể" for Mèo Miu; every other storyteller is just "the narration", never "Người kể chuyện kể". */
function useNarratorLabel(story: Story, scene: Scene): string {
  const { t } = useI18n();
  const name = story.narrators[scene.narrator]?.name;
  return scene.narrator === MIU_NARRATOR && name ? t('story.narratedBy', { name }) : t('story.narration');
}

/** The picture page: the scene's motion or still, or (until they exist) the scene title on a plain print block. */
function PicturePage({ story, scene, videoRef }: { story: Story; scene: Scene; videoRef?: RefObject<HTMLVideoElement | null> }): ReactNode {
  const media = sceneMedia(story.slug, scene);
  // Copies on a turning leaf (no videoRef) show the still: a playing <video> is never turned.
  const live = videoRef !== undefined;
  return (
    <div className="page page--picture">
      <div className="picture-frame" data-id={live ? 'story-picture' : undefined}>
        {media.video && live ? (
          <video ref={videoRef} className="picture-media" src={media.video} poster={media.image} muted loop playsInline preload="auto" aria-hidden="true" />
        ) : media.image ? (
          <img className="picture-media" src={media.image} alt="" width={900} height={1600} decoding="async" />
        ) : (
          <div className="picture-plain" data-id={live ? 'story-plain' : undefined}>
            <p className="picture-plain-title">{scene.title}</p>
          </div>
        )}
      </div>
    </div>
  );
}

/** The text page: who tells it and the subtitle line being read, always on screen. */
function TextPage({ label, line, live, progress }: { label: string; line: string; live: boolean; progress: number }): ReactNode {
  const { t } = useI18n();
  return (
    <section className="page page--text" aria-label={live ? t('story.subtitles') : undefined} data-id={live ? 'story-subtitles' : undefined}>
      <p className="subtitles-narrator">{label}</p>
      <p className="subtitles-line" lang="vi" aria-live={live ? 'polite' : undefined} data-id={live ? 'story-subtitle-line' : undefined}>
        {line}
      </p>
      <div className="scene-clock" aria-hidden="true">
        <span className="scene-clock-fill" style={{ transform: `scaleX(${Math.min(1, Math.max(0, progress))})` }} />
      </div>
    </section>
  );
}

interface SceneViewProps {
  story: Story;
  scene: Scene;
  status: PlayStatus;
  muted: boolean;
  onEnded: () => void;
  onLine: (line: string) => void;
}

/**
 * One scene as an open spread: the picture page and the text page, and the clock: the recorded voice when there
 * is one, otherwise a timer of the estimated reading time.
 */
function SceneView({ story, scene, status, muted, onEnded, onLine }: SceneViewProps): ReactNode {
  const media = sceneMedia(story.slug, scene);
  const playing = status === 'playing';
  const [voiceFailed, setVoiceFailed] = useState(false);
  const useVoice = media.voice !== undefined && !voiceFailed;
  const [voiceProgress, setVoiceProgress] = useState(0);
  const durationMs = Math.max(MIN_SCENE_SECONDS, estimateReadingSeconds(scene.narration)) * 1000;
  const elapsed = useSceneTimer(durationMs, playing && !useVoice, onEnded);
  const progress = useVoice ? voiceProgress : elapsed / durationMs;
  const line = scene.subtitles[Math.max(0, subtitleIndexAt(scene.subtitles, progress))] ?? '';
  const label = useNarratorLabel(story, scene);
  useEffect(() => onLine(line), [line, onLine]);

  const voiceRef = useRef<HTMLAudioElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const voiceRefused = useCallback(() => setVoiceFailed(true), []);
  useMediaPlayback(voiceRef, playing && useVoice, voiceRefused);
  useMediaPlayback(videoRef, playing);
  useEffect(() => {
    if (voiceRef.current) voiceRef.current.muted = muted;
  }, [muted]);

  return (
    <div className="spread" data-id="story-stage">
      <PicturePage story={story} scene={scene} videoRef={videoRef} />
      {useVoice && (
        // Captioned on the page: the text page shows the line being read, always.
        // eslint-disable-next-line jsx-a11y/media-has-caption
        <audio
          ref={voiceRef}
          src={media.voice}
          preload="auto"
          onTimeUpdate={(event) => {
            const { currentTime, duration } = event.currentTarget;
            if (duration > 0) setVoiceProgress(currentTime / duration);
          }}
          onEnded={onEnded}
          onError={() => setVoiceFailed(true)}
        />
      )}
      <TextPage label={label} line={line} live progress={progress} />
    </div>
  );
}

/** What the page showed when it started to turn: a scene and its line, or the last page. */
type Face = { kind: 'scene'; index: number; line: string } | { kind: 'end' };

interface Turn {
  id: number;
  from: Face;
  direction: TurnDirection;
}

/** A static copy of the page that is turning away, laid over the new one until its animation ends. */
function LeafScene({ story, scene, line }: { story: Story; scene: Scene; line: string }): ReactNode {
  const label = useNarratorLabel(story, scene);
  return (
    <div className="spread">
      <PicturePage story={story} scene={scene} />
      <TextPage label={label} line={line} live={false} progress={1} />
    </div>
  );
}

function Leaf({ story, turn, onDone }: { story: Story; turn: Turn; onDone: (id: number) => void }): ReactNode {
  const { from } = turn;
  const scene = from.kind === 'scene' ? story.scenes[from.index] : undefined;
  useEffect(() => {
    const id = window.setTimeout(() => onDone(turn.id), TURN_SAFETY_MS);
    return () => window.clearTimeout(id);
  }, [turn.id, onDone]);
  return (
    <div
      className={`leaf leaf--${turn.direction}`}
      aria-hidden="true"
      inert
      onAnimationEnd={(event) => {
        if (event.target === event.currentTarget) onDone(turn.id);
      }}
    >
      {scene && from.kind === 'scene' ? (
        <LeafScene story={story} scene={scene} line={from.line} />
      ) : (
        <EndPage story={story} copy onReplay={() => undefined} />
      )}
    </div>
  );
}

/** The leaf to show while the page key (scene or end) changes; cleared when its animation ends. */
function usePageTurn(state: PlayerState, line: string): [Turn | null, (id: number) => void] {
  const pageKey = state.status === 'ended' ? 'end' : `${state.index}`;
  const [turn, setTurn] = useState<Turn | null>(null);
  const [shown, setShown] = useState({ key: pageKey, index: state.index });
  if (shown.key !== pageKey) {
    // Derived during render (no effect): the leaf must be there in the same frame as the new page.
    const from: Face = shown.key === 'end' ? { kind: 'end' } : { kind: 'scene', index: shown.index, line };
    setShown({ key: pageKey, index: state.index });
    setTurn((previous) => ({ id: (previous?.id ?? 0) + 1, from, direction: state.direction }));
  }
  const done = useCallback((id: number) => setTurn((current) => (current?.id === id ? null : current)), []);
  return [turn, done];
}

interface StoryPlayerProps {
  story: Story;
  /** Leaves the reader (the × button, Escape). */
  onClose?: () => void;
}

/**
 * The reader: a book that fills the screen. A thin bar (close, title, scene), the scene progress in segments, the
 * book (one page on phones, an open spread from 880px), and the controls in thumb reach. Pages turn with the
 * buttons, the arrow keys and a sideways swipe; the adults' shelf also turns on a tap near a page edge.
 */
export function StoryPlayer({ story, onClose }: StoryPlayerProps): ReactNode {
  const { t } = useI18n();
  const [state, dispatch] = useReducer(playerReducer, story.scenes.length, initialPlayerState);
  const scene = story.scenes[state.index];
  const musicRef = useRef<HTMLAudioElement>(null);
  const playRef = useRef<HTMLButtonElement>(null);
  // The line on screen, kept so a turning leaf shows the words the page had.
  const [line, setLine] = useState('');
  const onEnded = useCallback(() => dispatch({ type: 'sceneEnded' }), []);
  const playing = state.status === 'playing';
  const noMedia = storyHasNoMedia(story);
  const [turn, turnDone] = usePageTurn(state, line);
  useMediaPlayback(musicRef, playing);
  useEffect(() => {
    const music = musicRef.current;
    if (!music) return;
    music.muted = state.muted;
    music.volume = MUSIC_VOLUME;
  }, [state.muted]);

  // Fetch the next scene's still ahead of the turn.
  useEffect(() => {
    for (const url of preloadAfter(story, state.index)) new Image().src = url;
  }, [story, state.index]);

  const turnTo = useCallback((to: 'next' | 'prev') => dispatch({ type: to }), []);
  const swipe = useSwipe(turnTo, story.shelf === 'adults');

  // Keys work anywhere on the page while the reader is open, except inside an open dialog (it has its own).
  useEffect(() => {
    function onKey(event: KeyboardEvent): void {
      if (document.querySelector('dialog[open]')) return;
      const { key, altKey, ctrlKey, metaKey, shiftKey } = event;
      const action = readerKeyAction({ key, altKey, ctrlKey, metaKey, shiftKey, focus: focusKind(event.target) });
      if (action === null) return;
      if (action === 'mute' && noMedia) return;
      if (action === 'close') {
        if (!onClose) return;
        onClose();
      } else if (action === 'mute') dispatch({ type: 'toggleMute' });
      else dispatch({ type: action });
      event.preventDefault();
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [noMedia, onClose]);

  useEffect(() => {
    playRef.current?.focus({ preventScroll: true });
  }, []);

  if (!scene) return null;
  const isFirst = state.index === 0;
  const ended = state.status === 'ended';
  const playLabel = playing ? t('story.pause') : state.status === 'idle' ? t('story.start') : ended ? t('story.replay') : t('story.resume');
  const sceneCount = story.scenes.length;

  return (
    <section className={`reader theme-${story.shelf}`} aria-label={t('story.reader', { title: story.title })} data-id="story-player" data-status={state.status}>
      <header className="reader-bar">
        {onClose && (
          <button type="button" className="icon-btn" onClick={onClose} aria-label={t('story.close')} data-id="story-close">
            <Icon name="close" />
          </button>
        )}
        <div className="reader-heading">
          <p className="reader-title" lang="vi">
            {story.title}
          </p>
          <p className="reader-scene" data-id="story-scene-number">
            {ended ? t('story.endTitle') : t('story.sceneOf', { n: state.index + 1, total: sceneCount })}
            {!ended && (
              <>
                {' · '}
                <span data-id="story-scene-title">{scene.title}</span>
              </>
            )}
          </p>
        </div>
      </header>

      <ol className="reader-progress" aria-label={t('story.progress')} data-id="story-progress">
        {story.scenes.map((each, i) => (
          <li key={each.id} className="reader-progress-step" data-state={ended || i < state.index ? 'done' : i === state.index ? 'now' : 'next'}>
            <span className="sr-only">{t('story.sceneOf', { n: i + 1, total: sceneCount })}</span>
          </li>
        ))}
      </ol>

      {noMedia && (
        <p className="player-note" data-id="story-no-media">
          {t(`story.noMedia.${story.shelf}`)}
        </p>
      )}

      <div className="book" data-turning={turn ? turn.direction : undefined} {...swipe}>
        {ended ? (
          <EndPage story={story} onReplay={() => dispatch({ type: 'toggle' })} />
        ) : (
          <SceneView key={`${state.index}-${state.run}`} story={story} scene={scene} status={state.status} muted={state.muted} onEnded={onEnded} onLine={setLine} />
        )}
        {turn && <Leaf key={turn.id} story={story} turn={turn} onDone={turnDone} />}
      </div>

      {/* Instrumental, no words to caption. */}
      {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
      {story.music.file && <audio ref={musicRef} src={storyFileUrl(story.slug, story.music.file)} loop preload="auto" />}

      <div className="reader-controls" role="group" aria-label={t('story.controls')} data-id="story-controls">
        <button type="button" className="icon-btn" onClick={() => dispatch({ type: 'prev' })} disabled={isFirst && !ended} aria-label={t('story.prev')} data-id="story-prev">
          <Icon name="prev" />
        </button>
        <button ref={playRef} type="button" className="play-btn" onClick={() => dispatch({ type: 'toggle' })} data-id="story-play">
          <Icon name={playing ? 'pause' : ended ? 'replay' : 'play'} />
          <span className="play-label">{playLabel}</span>
        </button>
        <button type="button" className="icon-btn" onClick={() => dispatch({ type: 'next' })} disabled={ended} aria-label={t('story.next')} data-id="story-next">
          <Icon name="next" />
        </button>
        {/* Nothing to mute until the story has a voice or music. */}
        {!noMedia && (
          <button type="button" className="icon-btn" aria-pressed={state.muted} onClick={() => dispatch({ type: 'toggleMute' })} aria-label={state.muted ? t('story.unmute') : t('story.mute')} data-id="story-mute">
            <Icon name={state.muted ? 'muted' : 'sound'} />
          </button>
        )}
      </div>
    </section>
  );
}
