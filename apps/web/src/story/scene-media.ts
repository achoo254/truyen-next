/** Where a story's files are on the site, and which ones to fetch ahead of the reader. */
import type { Scene, Story } from '@truyen/story';
import { storyFileUrl } from './story-location';

export { storyFileUrl };

export interface SceneMedia {
  image?: string;
  video?: string;
  voice?: string;
}

export function sceneMedia(slug: string, scene: Scene): SceneMedia {
  const media: SceneMedia = {};
  if (scene.image.file) media.image = storyFileUrl(slug, scene.image.file);
  if (scene.video.file) media.video = storyFileUrl(slug, scene.video.file);
  if (scene.voice.file) media.voice = storyFileUrl(slug, scene.voice.file);
  return media;
}

/** True when no scene has a picture, motion or voice yet and there is no music. */
export function storyHasNoMedia(story: Story): boolean {
  return story.music.file === undefined && story.scenes.every((scene) => Object.keys(sceneMedia(story.slug, scene)).length === 0);
}

/** True when the story can be heard: a whole recording, or a recorded voice on some scene. */
export function storyHasVoice(story: Story): boolean {
  return story.track !== undefined || story.scenes.some((scene) => scene.voice.file !== undefined);
}

/**
 * Progressive loading: only the scene on screen mounts its media; the next scene's still is fetched ahead so the
 * cut is instant. Its motion and voice load when it starts (they are larger, and the reader may stop before).
 */
export function preloadAfter(story: Story, index: number): string[] {
  const next = story.scenes[index + 1];
  const image = next ? sceneMedia(story.slug, next).image : undefined;
  return image ? [image] : [];
}
