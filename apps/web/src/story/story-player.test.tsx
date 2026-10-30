import { type Story, estimateReadingSeconds } from '@truyen/story';
import { pilotStory } from './pilot-story.test-support';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { I18nProvider } from '../i18n/i18n';
import { StoryPlayer } from './story-player';
import { TICK_MS } from './use-scene-timer';

const pilot = pilotStory;

beforeEach(() => {
  vi.useFakeTimers();
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

function show(story: Story = pilot()): void {
  render(
    <I18nProvider>
      <StoryPlayer story={story} />
    </I18nProvider>,
  );
}

const q = (id: string): HTMLElement => {
  const element = document.querySelector<HTMLElement>(`[data-id=${id}]`);
  if (!element) throw new Error(`no [data-id=${id}]`);
  return element;
};
const advance = (ms: number): void => {
  act(() => {
    vi.advanceTimersByTime(ms);
  });
};
const sceneMs = (story: Story, index: number): number => estimateReadingSeconds(story.scenes[index]?.narration ?? '') * 1000;

describe('story player without media', () => {
  it('shows the first scene, its first subtitle line and a plain backdrop, and says the media are not made yet', () => {
    const story = pilot();
    show(story);
    expect(q('story-scene-number').textContent).toBe(`Cảnh 1/8 · ${story.scenes[0]?.title}`);
    expect(q('story-subtitle-line').textContent).toBe(story.scenes[0]?.subtitles[0]);
    expect(screen.getByText('Mèo Miu kể')).toBeTruthy();
    expect(q('story-plain').textContent).toBe(story.scenes[0]?.title);
    expect(document.querySelectorAll('img, video, audio')).toHaveLength(0);
    expect(q('story-no-media')).toBeTruthy();
    expect(q('story-play').textContent).toBe('Bắt đầu');
    expect((q('story-prev') as HTMLButtonElement).disabled).toBe(true);
  });

  it('does not move on before it is started', () => {
    show();
    advance(60_000);
    expect(q('story-scene-number').textContent).toMatch(/^Cảnh 1\/8/);
  });

  it('moves the subtitles through the scene and on to the next scene after its reading time', () => {
    const story = pilot();
    show(story);
    fireEvent.click(q('story-play'));
    expect(q('story-play').textContent).toBe('Tạm dừng');
    advance(sceneMs(story, 0) * 0.98);
    expect(q('story-subtitle-line').textContent).toBe(story.scenes[0]?.subtitles.at(-1));
    advance(sceneMs(story, 0) * 0.02 + TICK_MS);
    expect(q('story-scene-number').textContent).toMatch(/^Cảnh 2\/8/);
    expect(q('story-subtitle-line').textContent).toBe(story.scenes[1]?.subtitles[0]);
    expect(screen.getByText('Lời kể')).toBeTruthy();
    expect(screen.queryByText('Người kể chuyện kể')).toBeNull();
  });

  it('holds its place while paused and goes on from there', () => {
    const story = pilot();
    show(story);
    fireEvent.click(q('story-play'));
    advance(sceneMs(story, 0) / 2);
    fireEvent.click(q('story-play'));
    expect(q('story-play').textContent).toBe('Tiếp tục');
    const line = q('story-subtitle-line').textContent;
    advance(120_000);
    expect(q('story-scene-number').textContent).toMatch(/^Cảnh 1\/8/);
    expect(q('story-subtitle-line').textContent).toBe(line);
    fireEvent.click(q('story-play'));
    advance(sceneMs(story, 0) / 2 + TICK_MS);
    expect(q('story-scene-number').textContent).toMatch(/^Cảnh 2\/8/);
  });

  it('steps with next and previous, restarting the scene from its first line', () => {
    const story = pilot();
    show(story);
    fireEvent.click(q('story-next'));
    fireEvent.click(q('story-next'));
    expect(q('story-scene-number').textContent).toMatch(/^Cảnh 3\/8/);
    fireEvent.click(q('story-prev'));
    expect(q('story-scene-number').textContent).toMatch(/^Cảnh 2\/8/);
    expect(q('story-subtitle-line').textContent).toBe(story.scenes[1]?.subtitles[0]);
  });

  it('ends after the last scene and plays again from the first', () => {
    const story = pilot();
    show(story);
    for (let i = 0; i < story.scenes.length - 1; i += 1) fireEvent.click(q('story-next'));
    fireEvent.click(q('story-play'));
    advance(sceneMs(story, story.scenes.length - 1) + TICK_MS);
    expect(q('story-ended').textContent).toContain('Mèo Miu chào bé nhé');
    expect(q('story-scene-number').textContent).toBe('Hết truyện');
    expect(q('story-end-shelf').getAttribute('href')).toBe('/tre-em');
    expect((q('story-next') as HTMLButtonElement).disabled).toBe(true);
    expect(q('story-play').textContent).toBe('Nghe lại');
    fireEvent.click(q('story-play'));
    expect(q('story-scene-number').textContent).toMatch(/^Cảnh 1\/8/);
    expect(document.querySelector('[data-id=story-ended]')).toBeNull();
  });

  it('offers no mute switch while the story has no sound', () => {
    show();
    fireEvent.click(q('story-more'));
    expect(document.querySelector('[data-id=pref-mute]')).toBeNull();
  });
});

describe('story player mute', () => {
  it('toggles mute', () => {
    const pause = vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => undefined);
    const story = pilot();
    show({ ...story, music: { ...story.music, file: 'media/music.m4a' } });
    fireEvent.click(q('story-more'));
    expect(q('pref-mute').getAttribute('aria-checked')).toBe('false');
    fireEvent.click(q('pref-mute'));
    expect(q('pref-mute').getAttribute('aria-checked')).toBe('true');
    expect(document.querySelector('audio')?.muted).toBe(true);
    pause.mockRestore();
  });
});

describe('story player with media', () => {
  it('mounts only the scene on screen: its still, motion and voice, and the music', () => {
    // jsdom has no media playback.
    const pause = vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => undefined);
    const story = pilot();
    const scenes = story.scenes.map((scene) => ({
      ...scene,
      image: { ...scene.image, file: `media/scenes/${scene.id}.webp` },
      video: { ...scene.video, file: `media/scenes/${scene.id}.mp4` },
      voice: { file: `media/scenes/${scene.id}.m4a` },
    }));
    show({ ...story, scenes, music: { ...story.music, file: 'media/music.m4a' } });
    expect(document.querySelector('[data-id=story-no-media]')).toBeNull();
    expect(document.querySelectorAll('video')).toHaveLength(1);
    expect(document.querySelector('video')?.getAttribute('src')).toBe('/stories/son-tinh-thuy-tinh/media/scenes/mo-dau.mp4');
    expect(document.querySelector('video')?.getAttribute('poster')).toBe('/stories/son-tinh-thuy-tinh/media/scenes/mo-dau.webp');
    expect([...document.querySelectorAll('audio')].map((a) => a.getAttribute('src'))).toEqual([
      '/stories/son-tinh-thuy-tinh/media/scenes/mo-dau.m4a',
      '/stories/son-tinh-thuy-tinh/media/music.m4a',
    ]);
    expect(pause).toHaveBeenCalled();
    pause.mockRestore();
  });
});

describe('story player keys and the end page', () => {
  it('turns pages with the arrow keys and plays on Space', () => {
    show();
    fireEvent.keyDown(document.body, { key: 'ArrowRight' });
    fireEvent.keyDown(document.body, { key: 'ArrowRight' });
    expect(q('story-scene-number').textContent).toMatch(/^Cảnh 3\/8/);
    fireEvent.keyDown(document.body, { key: 'ArrowLeft' });
    expect(q('story-scene-number').textContent).toMatch(/^Cảnh 2\/8/);
    fireEvent.keyDown(document.body, { key: ' ' });
    expect(q('story-player').getAttribute('data-status')).toBe('playing');
  });

  it('lays the leaving page over the new one while it turns, then clears it', () => {
    show();
    fireEvent.click(q('story-next'));
    expect(document.querySelector('.leaf--forward')).not.toBeNull();
    advance(1300);
    expect(document.querySelector('.leaf')).toBeNull();
    fireEvent.click(q('story-prev'));
    expect(document.querySelector('.leaf--back')).not.toBeNull();
  });

  it('closes on Escape when the page gave a way out', () => {
    const onClose = vi.fn();
    render(
      <I18nProvider>
        <StoryPlayer story={pilot()} onClose={onClose} />
      </I18nProvider>,
    );
    fireEvent.keyDown(document.body, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});

describe('reader options', () => {
  afterEach(() => window.localStorage.clear());

  it('waits on the last line when auto-turn is off, until the reader turns', () => {
    const story = pilot();
    show(story);
    fireEvent.click(q('story-more'));
    fireEvent.click(q('pref-auto-turn'));
    expect(JSON.parse(window.localStorage.getItem('truyen:prefs:v1') ?? '{}')).toMatchObject({ autoTurn: false });
    fireEvent.click(q('story-play'));
    advance(sceneMs(story, 0) + TICK_MS);
    expect(q('story-scene-number').textContent).toMatch(/^Cảnh 1\/8/);
    expect(q('story-next').getAttribute('data-waiting')).toBe('true');
    fireEvent.click(q('story-next'));
    expect(q('story-scene-number').textContent).toMatch(/^Cảnh 2\/8/);
    expect(q('story-player').getAttribute('data-status')).toBe('playing');
  });

  it('jumps to a scene from the scene list and remembers where the story was left', () => {
    show();
    fireEvent.click(q('story-scenes'));
    fireEvent.click(q('scene-index-5'));
    expect(q('story-scene-number').textContent).toMatch(/^Cảnh 5\/8/);
    expect(JSON.parse(window.localStorage.getItem('truyen:progress') ?? '{}')).toMatchObject({ 'son-tinh-thuy-tinh': { index: 4 } });
  });

  it('opens at the scene it was given, and sets the text size', () => {
    render(
      <I18nProvider>
        <StoryPlayer story={pilot()} initialIndex={3} />
      </I18nProvider>,
    );
    expect(q('story-scene-number').textContent).toMatch(/^Cảnh 4\/8/);
    fireEvent.click(q('story-more'));
    fireEvent.click(q('pref-text-l'));
    expect(q('story-player').getAttribute('data-text')).toBe('l');
  });

  it('dims and pauses when the sleep timer runs out, and wakes on request', () => {
    show();
    fireEvent.click(q('story-play'));
    fireEvent.click(q('story-more'));
    fireEvent.click(q('pref-sleep-10'));
    advance(10 * 60_000 + 1000);
    expect(q('story-player').getAttribute('data-sleep')).toBe('fading');
    advance(10_500);
    expect(q('story-player').getAttribute('data-status')).toBe('paused');
    fireEvent.click(q('sleep-wake'));
    expect(document.querySelector('[data-id=sleep-veil]')).toBeNull();
  });
});
