import { MIN_SCENE_SECONDS, type Scene, type Story, estimateReadingSeconds, subtitleIndexAt } from '@truyen/story';
import { type ReactNode, type RefObject, useCallback, useEffect, useReducer, useRef, useState } from 'react';
import { useI18n } from '../i18n/i18n';
import { type PlayStatus, initialPlayerState, playerReducer } from './player-state';
import { preloadAfter, sceneMedia, storyFileUrl, storyHasNoMedia } from './scene-media';
import { useSceneTimer } from './use-scene-timer';

/** Music sits under the voice. */
const MUSIC_VOLUME = 0.25;

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

interface SceneViewProps {
  story: Story;
  scene: Scene;
  status: PlayStatus;
  muted: boolean;
  onEnded: () => void;
}

/**
 * One scene: the picture (still or motion, or a plain backdrop until they exist), the subtitle line being read,
 * and the clock: the recorded voice when there is one, otherwise a timer of the estimated reading time.
 */
function SceneView({ story, scene, status, muted, onEnded }: SceneViewProps): ReactNode {
  const { t } = useI18n();
  const media = sceneMedia(story.slug, scene);
  const playing = status === 'playing';
  const [voiceFailed, setVoiceFailed] = useState(false);
  const useVoice = media.voice !== undefined && !voiceFailed;
  const [voiceProgress, setVoiceProgress] = useState(0);
  const durationMs = Math.max(MIN_SCENE_SECONDS, estimateReadingSeconds(scene.narration)) * 1000;
  const elapsed = useSceneTimer(durationMs, playing && !useVoice, onEnded);
  const progress = useVoice ? voiceProgress : elapsed / durationMs;
  const line = scene.subtitles[Math.max(0, subtitleIndexAt(scene.subtitles, progress))] ?? '';
  const narrator = story.narrators[scene.narrator]?.name ?? '';

  const voiceRef = useRef<HTMLAudioElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const voiceRefused = useCallback(() => setVoiceFailed(true), []);
  useMediaPlayback(voiceRef, playing && useVoice, voiceRefused);
  useMediaPlayback(videoRef, playing);
  useEffect(() => {
    if (voiceRef.current) voiceRef.current.muted = muted;
  }, [muted]);

  return (
    <div className="stage" data-id="story-stage">
      <div className="stage-picture" data-id="story-picture">
        {media.video ? (
          <video ref={videoRef} className="stage-media" src={media.video} poster={media.image} muted loop playsInline preload="auto" aria-hidden="true" />
        ) : media.image ? (
          <img className="stage-media" src={media.image} alt="" decoding="async" />
        ) : (
          // No art yet: a plain backdrop with the scene title, nothing drawn in its place.
          <div className="stage-plain" data-id="story-plain">
            <p className="stage-plain-title">{scene.title}</p>
          </div>
        )}
      </div>
      {useVoice && (
        // Captioned on the page: the subtitles below show the line being read, always.
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
      <section className="subtitles" aria-label={t('story.subtitles')} data-id="story-subtitles">
        <p className="subtitles-narrator">{t('story.narratedBy', { name: narrator })}</p>
        <p className="subtitles-line" lang="vi" aria-live="polite" data-id="story-subtitle-line">
          {line}
        </p>
        <progress className="scene-progress" max={1} value={Math.min(1, progress)} aria-hidden="true" />
      </section>
    </div>
  );
}

export function StoryPlayer({ story }: { story: Story }): ReactNode {
  const { t } = useI18n();
  const [state, dispatch] = useReducer(playerReducer, story.scenes.length, initialPlayerState);
  const scene = story.scenes[state.index];
  const musicRef = useRef<HTMLAudioElement>(null);
  const onEnded = useCallback(() => dispatch({ type: 'sceneEnded' }), []);
  const playing = state.status === 'playing';
  useMediaPlayback(musicRef, playing);
  useEffect(() => {
    const music = musicRef.current;
    if (!music) return;
    music.muted = state.muted;
    music.volume = MUSIC_VOLUME;
  }, [state.muted]);

  // Fetch the next scene's still ahead of the cut.
  useEffect(() => {
    for (const url of preloadAfter(story, state.index)) new Image().src = url;
  }, [story, state.index]);

  if (!scene) return null;
  const isFirst = state.index === 0;
  const playLabel = playing ? t('story.pause') : state.status === 'idle' ? t('story.start') : state.status === 'ended' ? t('story.replay') : t('story.resume');

  return (
    <div className="player" data-id="story-player" data-status={state.status}>
      {storyHasNoMedia(story) && (
        <p className="player-note" data-id="story-no-media">
          {t('story.noMedia')}
        </p>
      )}
      <p className="player-scene" data-id="story-scene-number">
        {t('story.sceneOf', { n: state.index + 1, total: story.scenes.length })} · <span data-id="story-scene-title">{scene.title}</span>
      </p>
      <SceneView key={`${state.index}-${state.run}`} story={story} scene={scene} status={state.status} muted={state.muted} onEnded={onEnded} />
      {state.status === 'ended' && (
        <p className="player-ended" role="status" data-id="story-ended">
          {t('story.ended')}
        </p>
      )}
      {/* Instrumental, no words to caption. */}
      {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
      {story.music.file && <audio ref={musicRef} src={storyFileUrl(story.slug, story.music.file)} loop preload="auto" />}
      <div className="controls" role="group" aria-label={t('story.controls')} data-id="story-controls">
        <button type="button" className="btn btn-secondary" onClick={() => dispatch({ type: 'prev' })} disabled={isFirst && state.status !== 'ended'} data-id="story-prev">
          {t('story.prev')}
        </button>
        <button type="button" className="btn btn-primary" onClick={() => dispatch({ type: 'toggle' })} data-id="story-play">
          {playLabel}
        </button>
        <button type="button" className="btn btn-secondary" onClick={() => dispatch({ type: 'next' })} disabled={state.status === 'ended'} data-id="story-next">
          {t('story.next')}
        </button>
        <button type="button" className="btn btn-ghost" aria-pressed={state.muted} onClick={() => dispatch({ type: 'toggleMute' })} data-id="story-mute">
          {state.muted ? t('story.unmute') : t('story.mute')}
        </button>
      </div>
    </div>
  );
}
