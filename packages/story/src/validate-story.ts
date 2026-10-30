/**
 * Reads a story.json and checks it as a whole: the shape (story-schema.ts) and the rules across fields that the
 * shape alone cannot say.
 */
import { estimateReadingSeconds } from './reading-time.ts';
import { type Story, storySchema } from './story-schema.ts';

export const MIN_SCENES = 6;
export const MAX_SCENES = 10;
/** A story read aloud takes three to six minutes. */
export const MIN_STORY_SECONDS = 180;
export const MAX_STORY_SECONDS = 360;
/** A subtitle line fits two short rows on a phone. */
export const MAX_SUBTITLE_CHARS = 90;
/** Mèo Miu, the guide of Miu World, opens and closes every story. */
export const MIU_NARRATOR = 'miu';

export type StoryResult = { ok: true; story: Story } | { ok: false; errors: string[] };

const normalise = (text: string): string => text.replace(/\s+/g, ' ').trim();

function duplicates(values: readonly string[]): string[] {
  return [...new Set(values.filter((value, index) => values.indexOf(value) !== index))];
}

/** Total estimated read-aloud length of the story's narration, in seconds. */
export function estimateStorySeconds(story: Story): number {
  return story.scenes.reduce((sum, scene) => sum + estimateReadingSeconds(scene.narration), 0);
}

function crossFieldErrors(story: Story): string[] {
  const errors: string[] = [];
  const { scenes, characters, narrators } = story;
  const characterIds = new Set(characters.map((c) => c.id));

  if (scenes.length < MIN_SCENES || scenes.length > MAX_SCENES) {
    errors.push(`scenes: ${scenes.length} scenes, expected ${MIN_SCENES}–${MAX_SCENES}`);
  }
  for (const dup of duplicates(scenes.map((s) => s.id))) errors.push(`scenes: id "${dup}" is used twice`);
  for (const dup of duplicates(characters.map((c) => c.id))) errors.push(`characters: id "${dup}" is used twice`);

  if (!narrators[MIU_NARRATOR]) errors.push(`narrators: "${MIU_NARRATOR}" (Mèo Miu) is missing`);
  const first = scenes[0];
  const last = scenes[scenes.length - 1];
  if (first && first.narrator !== MIU_NARRATOR) errors.push(`scenes.${first.id}: the opening scene is narrated by "${MIU_NARRATOR}"`);
  if (last && last.narrator !== MIU_NARRATOR) errors.push(`scenes.${last.id}: the closing scene is narrated by "${MIU_NARRATOR}"`);

  for (const scene of scenes) {
    const at = `scenes.${scene.id}`;
    if (!narrators[scene.narrator]) errors.push(`${at}: narrator "${scene.narrator}" is not in narrators`);
    if (scene.image.character !== undefined && !characterIds.has(scene.image.character)) {
      errors.push(`${at}.image.character: "${scene.image.character}" is not in characters`);
    }
    if (/\d/.test(scene.narration)) errors.push(`${at}.narration: write numbers as words, the voice misreads digits`);
    if (normalise(scene.subtitles.join(' ')) !== normalise(scene.narration)) {
      errors.push(`${at}.subtitles: joined, the lines must be exactly the narration`);
    }
    scene.subtitles.forEach((line, index) => {
      if (line.length > MAX_SUBTITLE_CHARS) errors.push(`${at}.subtitles[${index}]: ${line.length} characters, at most ${MAX_SUBTITLE_CHARS}`);
    });
  }

  const seconds = estimateStorySeconds(story);
  if (seconds < MIN_STORY_SECONDS || seconds > MAX_STORY_SECONDS) {
    errors.push(`scenes: about ${Math.round(seconds)} s read aloud, expected ${MIN_STORY_SECONDS}–${MAX_STORY_SECONDS} s`);
  }

  if (story.status === 'text-approved' && !story.review) errors.push('review: a text-approved story records who approved it and when');
  if (story.status === 'awaiting-text-review' && story.review) errors.push('review: set status to "text-approved" together with the review');
  return errors;
}

/** Checks parsed JSON; `expectedSlug` is the folder name the file was read from, when known. */
export function validateStory(data: unknown, expectedSlug?: string): StoryResult {
  const parsed = storySchema.safeParse(data);
  if (!parsed.success) {
    return { ok: false, errors: parsed.error.issues.map((issue) => `${issue.path.join('.') || '(root)'}: ${issue.message}`) };
  }
  const errors = crossFieldErrors(parsed.data);
  if (expectedSlug !== undefined && parsed.data.slug !== expectedSlug) errors.push(`slug: "${parsed.data.slug}" must match its folder "${expectedSlug}"`);
  return errors.length > 0 ? { ok: false, errors } : { ok: true, story: parsed.data };
}

/** Every media path the story refers to, relative to its folder. */
export function storyMediaFiles(story: Story): string[] {
  const files = [
    ...story.characters.map((c) => c.file),
    ...story.scenes.flatMap((s) => [s.image.file, s.video.file, s.voice.file]),
    story.music.file,
  ];
  return files.filter((file): file is string => file !== undefined);
}
