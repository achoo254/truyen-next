/**
 * The story format: one `stories/<slug>/story.json` per story. It holds the words (narration and subtitle lines)
 * the viewer shows, the prompts and seeds the build script sends to the PC, and the paths of the media made so
 * far. A media path is only written once the file exists, so the viewer never asks for a file that is not there.
 */
import { z } from 'zod';

const KEBAB = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/** The two shelves of the app: retellings for young children, and fuller tellings of the old tales for adults. */
export const SHELVES = ['kids', 'adults'] as const;
export const shelfSchema = z.enum(SHELVES);

/**
 * What a story is about, for the shelves' topic filter: myth, origin tale, heroes, good and evil, family, love,
 * nature. A story has one to three.
 */
export const THEMES = ['than-thoai', 'su-tich', 'anh-hung', 'thien-ac', 'gia-dinh', 'tinh-yeu', 'thien-nhien'] as const;
export const themeSchema = z.enum(THEMES);

const text = z.string().trim().min(1);
const id = z.string().regex(KEBAB, 'lowercase kebab-case');
/** artgen.py seeds are unsigned 32-bit. */
const seed = z.number().int().min(0).max(2 ** 32 - 1);

/** A media file inside the story folder, e.g. `media/scenes/mo-dau.webp`; no `..`, no absolute path. */
function mediaFile(extension: 'webp' | 'mp4' | 'm4a') {
  return z.string().regex(new RegExp(`^media/(?:[a-z0-9-]+/)*[a-z0-9-]+\\.${extension}$`), `a path like media/<name>.${extension}`);
}

export const narratorSchema = z.strictObject({
  /** Shown above the subtitles, e.g. "Mèo Miu". */
  name: text,
  /** Built-in VieNeu-TTS voice for voice.py, e.g. "Quỳnh Anh". */
  voice: text,
});

export const characterSchema = z.strictObject({
  id,
  name: text,
  /** Prompt of the character sheet, drawn once with `qwen` (or `klein-edit` when `refImage` is set). */
  sheetPrompt: text,
  seed,
  /**
   * An existing picture to draw the sheet from (`klein-edit --ref`), relative to the repository root, e.g. the
   * Miu World render of Mèo Miu so both apps show the same cat.
   */
  refImage: z.string().regex(/^(?:\.\.\/)?[\w./-]+\.(?:png|webp|jpg)$/).optional(),
  file: mediaFile('webp').optional(),
});

export const sceneSchema = z.strictObject({
  id,
  title: text,
  /** Key of `narrators`. */
  narrator: id,
  /** What the voice reads. Numbers are written as words: the voice model reads digits wrongly. */
  narration: text,
  /** The narration cut into lines shown one at a time; joined, they are exactly the narration. */
  subtitles: z.array(text).min(1),
  image: z.strictObject({
    /** English prompt of the still (the story's `style` is added to it). */
    prompt: text,
    seed,
    /** Character whose sheet is the `klein-edit --ref`, to keep them alike between scenes; none: `qwen`. */
    character: id.optional(),
    file: mediaFile('webp').optional(),
  }),
  video: z.strictObject({
    /** English prompt of the gentle motion `wan-i2v` adds to the still. */
    motionPrompt: text,
    seed,
    file: mediaFile('mp4').optional(),
  }),
  voice: z.strictObject({
    file: mediaFile('m4a').optional(),
  }),
});

/**
 * The whole story as one recording, made by `pnpm story:build --only track` from the scene voices and the music:
 * each voice in scene order over the music bed, which is turned down under the voice. The reader plays it with a
 * single audio element, so the story goes on scene after scene without page timers (a locked phone keeps it going),
 * and turns the pages by its clock: scene `i` is on from `scenes[i].start` until the next scene starts.
 */
export const trackSchema = z.strictObject({
  file: mediaFile('m4a'),
  /** Length of the recording, in seconds. */
  duration: z.number().positive().max(3600),
  /** Where each scene's voice starts and ends in the recording (seconds), in the order of `scenes`. */
  scenes: z.array(z.strictObject({ id, start: z.number().min(0), end: z.number().positive() })).min(1),
});

export const storySchema = z.strictObject({
  schemaVersion: z.literal(1),
  slug: id,
  /** Which shelf the story sits on; each shelf has its own length, narrator and safety rules (validate-story.ts). */
  shelf: shelfSchema,
  title: text,
  summary: text,
  /** Topics for the shelves' filter (optional; a story without them shows under every topic filter's "all"). */
  themes: z.array(themeSchema).min(1).max(3).optional(),
  /** When the story joined the shelf (YYYY-MM-DD), for "newest first". */
  added: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'a date like 2026-10-30').optional(),
  language: z.literal('vi'),
  /** Where the tale comes from and how the words were written. */
  source: text,
  /** Art direction added to every image and sheet prompt, so the whole story looks like one book. */
  style: text,
  narrators: z.record(id, narratorSchema),
  characters: z.array(characterSchema),
  scenes: z.array(sceneSchema),
  music: z.strictObject({
    /** English prompt of the instrumental bed (`ace-music`, no lyrics). */
    prompt: text,
    /** Length asked of ace-music; the viewer loops it under the whole story. */
    durationSeconds: z.number().int().min(10).max(300),
    seed,
    file: mediaFile('m4a').optional(),
  }),
  /** The story as one recording, once the voices and the music exist (see trackSchema). */
  track: trackSchema.optional(),
});

export type Story = z.infer<typeof storySchema>;
export type Scene = z.infer<typeof sceneSchema>;
export type StoryTrack = z.infer<typeof trackSchema>;
export type Character = z.infer<typeof characterSchema>;
export type Narrator = z.infer<typeof narratorSchema>;
export type Shelf = z.infer<typeof shelfSchema>;
export type Theme = z.infer<typeof themeSchema>;
