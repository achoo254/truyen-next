import { MIN_SCENE_SECONDS, MIU_NARRATOR, type Scene, type Story, estimateReadingSeconds, subtitleIndexAt } from '@truyen/story';
import { type ReactNode, type RefObject, useCallback, useEffect, useReducer, useRef, useState } from 'react';
import { coverArt } from '../art/story-cover';
import { Emblem } from '../art/story-emblems';
import { useI18n } from '../i18n/i18n';
import { Icon } from '../ui/icons';
import { EndPage } from './end-page';
import { type PlayStatus, type PlayerState, type TurnDirection, initialPlayerState, playerReducer } from './player-state';
import { focusKind, readerKeyAction } from './reader-keys';
import { type Rate, useReaderPrefs } from './reader-prefs';
import { preloadAfter, sceneMedia, storyFileUrl, storyHasNoMedia } from './scene-media';
import { useSceneTimer } from './use-scene-timer';
import { useSwipe } from './use-swipe';
import { ReaderSheet } from './reader-sheet';
import { SceneIndex } from './scene-index';
import { forgetProgress, saveProgress } from './reading-progress';
import { fadeShare, minutesLeft, type SleepOption, sleepDeadline } from './sleep-timer';
import { storyPath } from './story-api';
import { LightsSwitch } from '../ui/lights-switch';
import { useLights } from '../ui/lights';
import { SceneBackdrop } from './scene-backdrop';
import { ScenePicker } from './scene-picker';

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
          // "A block not yet printed in colour": the story's carved emblem, faint, under the scene title.
          <div className="picture-plain" data-id={live ? 'story-plain' : undefined}>
            <Emblem name={coverArt(story.slug).emblem} className="picture-plain-emblem" />
            <p className="picture-plain-title">{scene.title}</p>
          </div>
        )}
      </div>
    </div>
  );
}

/** The text page: who tells it and the subtitle line being read, always on screen. */
function TextPage({ label, line, live, progress, hideLine = false }: { label: string; line: string; live: boolean; progress: number; hideLine?: boolean }): ReactNode {
  const { t } = useI18n();
  return (
    <section className="page page--text" aria-label={live ? t('story.subtitles') : undefined} data-id={live ? 'story-subtitles' : undefined}>
      <p className="subtitles-narrator">{label}</p>
      <p className={hideLine ? 'subtitles-line subtitles-line--hidden' : 'subtitles-line'} lang="vi" aria-live={live ? 'polite' : undefined} data-id={live ? 'story-subtitle-line' : undefined}>
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
  rate: Rate;
  /** False only when the reader turned subtitles off and the scene has a voice to follow. */
  showLine: boolean;
  onEnded: () => void;
  onLine: (line: string) => void;
}

/**
 * One scene as an open spread: the picture page and the text page, and the clock: the recorded voice when there
 * is one, otherwise a timer of the estimated reading time.
 */
function SceneView({ story, scene, status, muted, rate, showLine, onEnded, onLine }: SceneViewProps): ReactNode {
  const media = sceneMedia(story.slug, scene);
  const playing = status === 'playing';
  const [voiceFailed, setVoiceFailed] = useState(false);
  const useVoice = media.voice !== undefined && !voiceFailed;
  const [voiceProgress, setVoiceProgress] = useState(0);
  const durationMs = (Math.max(MIN_SCENE_SECONDS, estimateReadingSeconds(scene.narration)) * 1000) / rate;
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
  useEffect(() => {
    if (voiceRef.current) voiceRef.current.playbackRate = rate;
  }, [rate, useVoice]);

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
      <TextPage label={label} line={line} live progress={progress} hideLine={!(showLine || !useVoice)} />
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
        <EndPage story={story} copy />
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
  /** The scene to open at (continue where the reader left off, a shared `?canh=` link). */
  initialIndex?: number;
  /** Leaves the reader (the × button, Escape). */
  onClose?: () => void;
}

/** Full screen where the browser allows it on an element (not iPhone Safari: the reader already fills the screen there). */
function useFullscreen(target: RefObject<HTMLElement | null>): { supported: boolean; on: boolean; toggle: () => void } {
  const [on, setOn] = useState(false);
  const supported = typeof document !== 'undefined' && document.fullscreenEnabled === true;
  useEffect(() => {
    const update = (): void => setOn(document.fullscreenElement !== null);
    document.addEventListener('fullscreenchange', update);
    return () => document.removeEventListener('fullscreenchange', update);
  }, []);
  const toggle = useCallback(() => {
    const request = document.fullscreenElement ? document.exitFullscreen() : target.current?.requestFullscreen();
    request?.catch((error: unknown) => console.warn('full screen refused', error instanceof Error ? error.name : typeof error));
  }, [target]);
  return { supported, on, toggle };
}

/** Sleep timer: dims page and sound for the fade (sleep-timer.ts) when it runs out (or at the story's end), then pauses. */
function useSleep(status: PlayStatus, pause: () => void, reader: RefObject<HTMLElement | null>) {
  const [option, setOption] = useState<SleepOption>('off');
  const [deadline, setDeadline] = useState<number | null>(null);
  const [phase, setPhase] = useState<'awake' | 'fading' | 'asleep'>('awake');
  const [now, setNow] = useState(() => Date.now());
  const pick = useCallback((next: SleepOption) => {
    const at = Date.now();
    setOption(next);
    setDeadline(sleepDeadline(next, at));
    setNow(at);
    setPhase('awake');
  }, []);
  // A clock for the minutes left, and the moment the timer runs out.
  useEffect(() => {
    if (deadline === null || phase !== 'awake') return undefined;
    const id = window.setInterval(() => {
      const at = Date.now();
      setNow(at);
      if (at >= deadline) setPhase('fading');
    }, 1000);
    return () => window.clearInterval(id);
  }, [deadline, phase]);
  // The fade: every sound of the reader turns down, then the story pauses and the page stays dark.
  useEffect(() => {
    if (phase !== 'fading') return undefined;
    const start = Date.now();
    const id = window.setInterval(() => {
      const share = fadeShare(start, Date.now());
      for (const audio of reader.current?.querySelectorAll('audio') ?? []) audio.volume = share * (audio.loop ? MUSIC_VOLUME : 1);
      if (share <= 0) {
        window.clearInterval(id);
        pause();
        setPhase('asleep');
      }
    }, 250);
    return () => window.clearInterval(id);
  }, [phase, pause, reader]);
  const wake = useCallback(() => {
    for (const audio of reader.current?.querySelectorAll('audio') ?? []) audio.volume = audio.loop ? MUSIC_VOLUME : 1;
    setOption('off');
    setDeadline(null);
    setPhase('awake');
  }, [reader]);
  // "At the end of the story": the last page is reached, nothing to fade (the story has stopped by itself).
  const shown = option === 'end' && status === 'ended' && phase === 'awake' ? 'asleep' : phase;
  return { option, pick, phase: shown, wake, minutesLeft: deadline === null ? null : minutesLeft(deadline, now) };
}

/**
 * The reader: a book that fills the screen. A thin bar (close, title, scene, lights), the scene progress in
 * segments (a tap opens the scene list), the book (one page on phones, an open spread from 880px), and the
 * controls in thumb reach. Pages turn with the buttons, the arrow keys and a sideways swipe; the adults' shelf also
 * turns on a tap near a page edge. The options sheet holds everything else.
 */
export function StoryPlayer({ story, initialIndex = 0, onClose }: StoryPlayerProps): ReactNode {
  const { t } = useI18n();
  const [state, dispatch] = useReducer(playerReducer, undefined, () => {
    const start = initialPlayerState(story.scenes.length);
    const index = Number.isInteger(initialIndex) && initialIndex > 0 && initialIndex < story.scenes.length ? initialIndex : 0;
    return { ...start, index };
  });
  const [prefs, updatePrefs] = useReaderPrefs();
  const lightsOff = useLights() === 'off';
  const readingSceneId = prefs.scenes[story.shelf];
  const scene = story.scenes[state.index];
  const readerRef = useRef<HTMLElement>(null);
  const musicRef = useRef<HTMLAudioElement>(null);
  const playRef = useRef<HTMLButtonElement>(null);
  // The line on screen, kept so a turning leaf shows the words the page had.
  const [line, setLine] = useState('');
  const [sheetOpen, setSheetOpen] = useState(false);
  const [scenesOpen, setScenesOpen] = useState(false);
  const [shareNote, setShareNote] = useState<string | null>(null);
  const autoTurn = prefs.autoTurn;
  const onEnded = useCallback(() => dispatch({ type: 'sceneEnded', autoTurn }), [autoTurn]);
  const pause = useCallback(() => dispatch({ type: 'pause' }), []);
  const playing = state.status === 'playing';
  const ended = state.status === 'ended';
  const noMedia = storyHasNoMedia(story);
  const hasVoice = story.scenes.some((each) => each.voice.file !== undefined);
  const [turn, turnDone] = usePageTurn(state, line);
  const fullscreen = useFullscreen(readerRef);
  const sleep = useSleep(state.status, pause, readerRef);
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

  // Remember where the story was left; a story read to its end is forgotten.
  useEffect(() => {
    if (ended) forgetProgress(story.slug);
    else if (state.status !== 'idle' || state.index > 0) saveProgress(story.slug, state.index);
  }, [story.slug, state.index, state.status, ended]);

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

  const share = useCallback(async () => {
    const url = `${window.location.origin}${storyPath(story.slug)}?canh=${state.index + 1}`;
    try {
      if (typeof navigator.share === 'function') {
        await navigator.share({ title: story.title, url });
        return;
      }
      await navigator.clipboard.writeText(url);
      setShareNote(t('reader.shared'));
    } catch (error) {
      // The reader closing the share panel is not a failure.
      if (error instanceof Error && error.name === 'AbortError') return;
      console.warn('share failed', error instanceof Error ? error.name : typeof error);
      setShareNote(t('reader.shareFailed'));
    }
  }, [story.slug, story.title, state.index, t]);

  if (!scene) return null;
  const isFirst = state.index === 0;
  const playLabel = playing ? t('story.pause') : state.status === 'idle' ? t('story.start') : ended ? t('story.replay') : t('story.resume');
  const sceneCount = story.scenes.length;

  return (
    <section
      ref={readerRef}
      className={`reader theme-${story.shelf}`}
      aria-label={t('story.reader', { title: story.title })}
      data-id="story-player"
      data-status={state.status}
      data-text={prefs.textSize}
      data-sleep={sleep.phase}
      data-scene={readingSceneId}
    >
      <SceneBackdrop id={readingSceneId} lightsOff={lightsOff} />
      <header className="reader-bar">
        {onClose && (
          <button type="button" className="icon-btn icon-btn--flat" onClick={onClose} aria-label={t('story.close')} data-id="story-close">
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
        <LightsSwitch className="icon-btn icon-btn--flat" dataId="reader-lights" />
        <button type="button" className="reader-progress" onClick={() => setScenesOpen(true)} aria-label={t('story.progress')} data-id="story-progress">
          {story.scenes.map((each, i) => (
            <span key={each.id} className="reader-progress-step" data-state={ended || i < state.index ? 'done' : i === state.index ? 'now' : 'next'} />
          ))}
        </button>
        {noMedia && (
          <p className="player-note" data-id="story-no-media">
            {t(`story.noMedia.${story.shelf}`)}
          </p>
        )}
      </header>

      <div className="book" data-turning={turn ? turn.direction : undefined} {...swipe}>
        {ended ? (
          <EndPage story={story} />
        ) : (
          <SceneView
            key={`${state.index}-${state.run}`}
            story={story}
            scene={scene}
            status={state.status}
            muted={state.muted}
            rate={prefs.rate}
            showLine={prefs.subtitles}
            onEnded={onEnded}
            onLine={setLine}
          />
        )}
        {turn && <Leaf key={turn.id} story={story} turn={turn} onDone={turnDone} />}
      </div>

      {/* Instrumental, no words to caption. */}
      {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
      {story.music.file && <audio ref={musicRef} src={storyFileUrl(story.slug, story.music.file)} loop preload="auto" />}

      <div className="reader-controls" role="group" aria-label={t('story.controls')} data-id="story-controls">
        <button type="button" className="icon-btn" onClick={() => setScenesOpen(true)} aria-label={t('story.progress')} data-id="story-scenes">
          <Icon name="scenes" />
        </button>
        <button type="button" className="icon-btn" onClick={() => dispatch({ type: 'prev' })} disabled={isFirst && !ended} aria-label={t('story.prev')} data-id="story-prev">
          <Icon name="prev" />
        </button>
        <button ref={playRef} type="button" className="play-btn" onClick={() => dispatch({ type: 'toggle' })} data-id="story-play">
          <Icon name={playing ? 'pause' : ended ? 'replay' : 'play'} />
          <span className="sr-only">{playLabel}</span>
        </button>
        <button
          type="button"
          className="icon-btn"
          onClick={() => dispatch({ type: 'next' })}
          disabled={ended}
          aria-label={state.holding ? t('reader.turnHint') : t('story.next')}
          data-waiting={state.holding || undefined}
          data-id="story-next"
        >
          <Icon name="next" />
        </button>
        <button type="button" className="icon-btn" onClick={() => setSheetOpen(true)} aria-label={t('reader.options')} aria-haspopup="dialog" data-id="story-more">
          <Icon name="more" />
        </button>
      </div>

      <ReaderSheet
        open={sheetOpen}
        onClose={() => {
          setSheetOpen(false);
          setShareNote(null);
        }}
        prefs={prefs}
        onPrefs={updatePrefs}
        hasVoice={hasVoice}
        hasSound={!noMedia}
        muted={state.muted}
        onToggleMute={() => dispatch({ type: 'toggleMute' })}
        sleep={sleep.option}
        sleepMinutesLeft={sleep.minutesLeft}
        onSleep={sleep.pick}
        fullscreen={fullscreen}
        onShare={() => void share()}
        shareNote={shareNote}
        onScenes={() => {
          setSheetOpen(false);
          setScenesOpen(true);
        }}
      >
        <ScenePicker value={readingSceneId} lightsOff={lightsOff} onChange={(id) => updatePrefs({ scenes: { ...prefs.scenes, [story.shelf]: id } })} />
      </ReaderSheet>
      <SceneIndex story={story} current={state.index} open={scenesOpen} onClose={() => setScenesOpen(false)} onPick={(index) => dispatch({ type: 'goTo', index })} />

      {sleep.phase !== 'awake' && (
        <div className="sleep-veil" data-id="sleep-veil">
          {sleep.phase === 'asleep' && (
            <div className="sleep-card" role="status">
              <p className="sleep-word">{t('reader.goodnight')}</p>
              <button type="button" className="btn btn-secondary" onClick={sleep.wake} data-id="sleep-wake">
                {t('reader.wake')}
              </button>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
