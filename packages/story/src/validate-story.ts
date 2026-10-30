/**
 * Reads a story.json and checks it as a whole: the shape (story-schema.ts) and the rules across fields that the
 * shape alone cannot say, which differ between the children's shelf and the adults' shelf.
 */
import { estimateReadingSeconds } from './reading-time.ts';
import { type Shelf, type Story, storySchema } from './story-schema.ts';

export interface ShelfRules {
  minScenes: number;
  maxScenes: number;
  /** Estimated read-aloud length, in seconds. */
  minSeconds: number;
  maxSeconds: number;
}

/** Children: six to ten scenes, three to six minutes. Adults: a fuller telling, eight to fourteen scenes, six to twelve minutes. */
export const SHELF_RULES: Record<Shelf, ShelfRules> = {
  kids: { minScenes: 6, maxScenes: 10, minSeconds: 180, maxSeconds: 360 },
  adults: { minScenes: 8, maxScenes: 14, minSeconds: 360, maxSeconds: 720 },
};
/** A subtitle line fits two short rows on a phone. */
export const MAX_SUBTITLE_CHARS = 90;
/** Mèo Miu, the guide of Miu World, opens and closes every children's story, and only those. */
export const MIU_NARRATOR = 'miu';
/** The VieNeu voice of Mèo Miu, as in Miu World. */
export const MIU_VOICE = 'Trúc Ly';
/** The storyteller's voice of the children's shelf. */
export const KIDS_STORYTELLER_VOICE = 'Quỳnh Anh';
/** Built-in VieNeu voices that speech recognition understood poorly; not used for narration. */
export const DROPPED_VOICES: readonly string[] = ['Ngọc Trân', 'Quang Sơn', 'Thùy Dung', 'Minh Triết'];

/**
 * Words a children's retelling never says: killing, blood and death are told around, not described. A guard
 * against slips, not a judge of tone; the retelling itself is written to be gentle.
 */
const KIDS_UNSAFE_WORDS = ['giết', 'máu', 'chết', 'chém', 'thi thể', 'xác chết', 'ghê rợn', 'rùng rợn'];
/** Words no picture or motion prompt of either shelf asks for. */
const GORE_PROMPT_WORDS = ['blood', 'bloody', 'gore', 'gory', 'corpse', 'severed', 'wound', 'skull'];
/** And, for the children's shelf, not even death, killing or weapons drawn to hurt. */
const KIDS_UNSAFE_PROMPT_WORDS = [...GORE_PROMPT_WORDS, 'dead', 'death', 'dying', 'kill', 'killing', 'killed', 'sword', 'spear'];

export type StoryResult = { ok: true; story: Story } | { ok: false; errors: string[] };

const normalise = (text: string): string => text.replace(/\s+/g, ' ').trim();

function duplicates(values: readonly string[]): string[] {
  return [...new Set(values.filter((value, index) => values.indexOf(value) !== index))];
}

/** The listed words (or phrases) that `text` contains as whole words, ignoring case. */
export function wordsFound(text: string, words: readonly string[]): string[] {
  const lower = text.toLowerCase();
  return words.filter((word) => new RegExp(`(?<![\\p{L}\\p{M}])${word}(?![\\p{L}\\p{M}])`, 'u').test(lower));
}

/** Total estimated read-aloud length of the story's narration, in seconds. */
export function estimateStorySeconds(story: Story): number {
  return story.scenes.reduce((sum, scene) => sum + estimateReadingSeconds(scene.narration), 0);
}

/** Children's shelf: Mèo Miu (Trúc Ly) opens and closes, the storyteller reads with Quỳnh Anh, nothing frightening. */
function kidsErrors(story: Story): string[] {
  const errors: string[] = [];
  const { scenes, narrators } = story;
  const miu = narrators[MIU_NARRATOR];
  if (!miu) errors.push(`narrators: "${MIU_NARRATOR}" (Mèo Miu) is missing`);
  else if (miu.voice !== MIU_VOICE) errors.push(`narrators.${MIU_NARRATOR}: Mèo Miu speaks with "${MIU_VOICE}"`);
  for (const [key, narrator] of Object.entries(narrators)) {
    if (key !== MIU_NARRATOR && narrator.voice !== KIDS_STORYTELLER_VOICE) {
      errors.push(`narrators.${key}: the children's storyteller speaks with "${KIDS_STORYTELLER_VOICE}"`);
    }
  }
  const first = scenes[0];
  const last = scenes[scenes.length - 1];
  if (first && first.narrator !== MIU_NARRATOR) errors.push(`scenes.${first.id}: the opening scene is narrated by "${MIU_NARRATOR}"`);
  if (last && last.narrator !== MIU_NARRATOR) errors.push(`scenes.${last.id}: the closing scene is narrated by "${MIU_NARRATOR}"`);

  for (const [at, text] of [['title', story.title], ['summary', story.summary]] as const) {
    for (const word of wordsFound(text, KIDS_UNSAFE_WORDS)) errors.push(`${at}: "${word}" has no place in a children's retelling`);
  }
  for (const scene of scenes) {
    for (const word of wordsFound(`${scene.title} ${scene.narration}`, KIDS_UNSAFE_WORDS)) {
      errors.push(`scenes.${scene.id}.narration: "${word}" has no place in a children's retelling`);
    }
  }
  return errors;
}

/** Adults' shelf: one storyteller with a voice of their own, no Mèo Miu. */
function adultsErrors(story: Story): string[] {
  const errors: string[] = [];
  const entries = Object.entries(story.narrators);
  if (entries.length !== 1) errors.push(`narrators: an adults' story has one storyteller, found ${entries.length}`);
  for (const [key, narrator] of entries) {
    if (key === MIU_NARRATOR) errors.push(`narrators.${key}: Mèo Miu narrates only the children's shelf`);
    if (narrator.voice === MIU_VOICE || narrator.voice === KIDS_STORYTELLER_VOICE) {
      errors.push(`narrators.${key}: "${narrator.voice}" is a children's shelf voice; the adults' storyteller has another`);
    }
  }
  if (story.characters.some((c) => c.id === MIU_NARRATOR)) errors.push(`characters.${MIU_NARRATOR}: Mèo Miu appears only on the children's shelf`);
  return errors;
}

function crossFieldErrors(story: Story): string[] {
  const errors: string[] = [];
  const { scenes, characters, narrators } = story;
  const rules = SHELF_RULES[story.shelf];
  const characterIds = new Set(characters.map((c) => c.id));

  if (scenes.length < rules.minScenes || scenes.length > rules.maxScenes) {
    errors.push(`scenes: ${scenes.length} scenes, expected ${rules.minScenes}–${rules.maxScenes} on the ${story.shelf} shelf`);
  }
  for (const dup of duplicates(scenes.map((s) => s.id))) errors.push(`scenes: id "${dup}" is used twice`);
  for (const dup of duplicates(characters.map((c) => c.id))) errors.push(`characters: id "${dup}" is used twice`);
  for (const [key, narrator] of Object.entries(narrators)) {
    if (DROPPED_VOICES.includes(narrator.voice)) errors.push(`narrators.${key}: "${narrator.voice}" is not used, speech recognition hears it poorly`);
  }

  errors.push(...(story.shelf === 'kids' ? kidsErrors(story) : adultsErrors(story)));

  const promptWords = story.shelf === 'kids' ? KIDS_UNSAFE_PROMPT_WORDS : GORE_PROMPT_WORDS;
  for (const character of characters) {
    for (const word of wordsFound(character.sheetPrompt, promptWords)) errors.push(`characters.${character.id}.sheetPrompt: no "${word}"`);
  }

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
    for (const word of wordsFound(scene.image.prompt, promptWords)) errors.push(`${at}.image.prompt: no "${word}"`);
    for (const word of wordsFound(scene.video.motionPrompt, promptWords)) errors.push(`${at}.video.motionPrompt: no "${word}"`);
  }

  const seconds = estimateStorySeconds(story);
  if (seconds < rules.minSeconds || seconds > rules.maxSeconds) {
    errors.push(`scenes: about ${Math.round(seconds)} s read aloud, expected ${rules.minSeconds}–${rules.maxSeconds} s on the ${story.shelf} shelf`);
  }

  return errors;
}

/** Checks parsed JSON; `expectedSlug` is the folder name the file was read from, when known. */
export function validateStory(data: unknown, expectedSlug?: string): StoryResult {
  const parsed = storySchema.safeParse(data);
  if (!parsed.success) {
    return { ok: false, errors: parsed.error.issues.map((issue) => `${issue.path.join('.') || '(root)'}: ${issue.message}`) };
  }
  const errors = crossFieldErrors(parsed.data);
  const themes = parsed.data.themes ?? [];
  if (new Set(themes).size !== themes.length) errors.push('themes: a topic is listed twice');
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
