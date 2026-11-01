import { describe, expect, it } from 'vitest';
import { pilotStory } from './pilot-story.test-support';
import { preloadAfter, sceneMedia, storyFileUrl, storyHasNoMedia, storyHasVoice } from './scene-media';

const pilot = pilotStory;

describe('scene media', () => {
  it('has no media for the pilot yet, so nothing is fetched', () => {
    const story = pilot();
    expect(storyHasNoMedia(story)).toBe(true);
    expect(storyHasVoice(story)).toBe(false);
    expect(story.scenes.map((scene) => sceneMedia(story.slug, scene))).toEqual(story.scenes.map(() => ({})));
    expect(preloadAfter(story, 0)).toEqual([]);
  });

  it('fetches only the next still ahead, once it exists', () => {
    const story = pilot();
    const scenes = story.scenes.map((scene, i) =>
      i === 1 ? { ...scene, image: { ...scene.image, file: 'media/scenes/vua-va-cong-chua.webp' }, voice: { file: 'media/scenes/vua-va-cong-chua.m4a' } } : scene,
    );
    const withMedia = { ...story, scenes };
    expect(storyHasNoMedia(withMedia)).toBe(false);
    expect(storyHasVoice(withMedia)).toBe(true);
    expect(preloadAfter(withMedia, 0)).toEqual(['/stories/son-tinh-thuy-tinh/media/scenes/vua-va-cong-chua.webp']);
    expect(preloadAfter(withMedia, 1)).toEqual([]);
    expect(preloadAfter(withMedia, story.scenes.length - 1)).toEqual([]);
    const second = scenes[1];
    if (!second) throw new Error('pilot has one scene');
    expect(sceneMedia(story.slug, second)).toEqual({
      image: '/stories/son-tinh-thuy-tinh/media/scenes/vua-va-cong-chua.webp',
      voice: '/stories/son-tinh-thuy-tinh/media/scenes/vua-va-cong-chua.m4a',
    });
    expect(storyFileUrl('a b', 'story.json')).toBe('/stories/a%20b/story.json');
  });
});
