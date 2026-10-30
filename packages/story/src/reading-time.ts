/**
 * How long words take to read aloud, used where no recorded voice exists yet (the viewer's scene timer, the
 * story length check) and to place each subtitle line inside a recording.
 */

/** Calm read-aloud pace, in Vietnamese syllables (written words) per second; the same for both shelves. */
export const SYLLABLES_PER_SECOND = 2.4;
/** Breath taken after each sentence. */
export const SENTENCE_PAUSE_SECONDS = 0.5;
/** No scene is shorter than this, so a short line still stays on screen long enough to read. */
export const MIN_SCENE_SECONDS = 4;

/** Vietnamese writes one syllable per word: count the words that contain a letter. */
export function syllableCount(text: string): number {
  return text.split(/\s+/).filter((word) => /\p{L}/u.test(word)).length;
}

function sentenceCount(text: string): number {
  return (text.match(/[.!?…]+(?=\s|$)/g) ?? []).length;
}

/** Estimated seconds to read `text` aloud. */
export function estimateReadingSeconds(text: string): number {
  const seconds = syllableCount(text) / SYLLABLES_PER_SECOND + sentenceCount(text) * SENTENCE_PAUSE_SECONDS;
  return Math.max(MIN_SCENE_SECONDS, Math.round(seconds * 10) / 10);
}

/**
 * Where each subtitle line starts, as a share (0–1) of the scene, in proportion to its syllables: without
 * word timings from the voice, a line takes as long as its words take to say.
 */
export function subtitleStarts(lines: readonly string[]): number[] {
  const weights = lines.map((line) => Math.max(1, syllableCount(line)));
  const total = weights.reduce((sum, weight) => sum + weight, 0);
  const starts: number[] = [];
  let before = 0;
  for (const weight of weights) {
    starts.push(before / total);
    before += weight;
  }
  return starts;
}

/** Index of the subtitle line shown at `progress` (0–1) of the scene. */
export function subtitleIndexAt(lines: readonly string[], progress: number): number {
  if (lines.length === 0) return -1;
  const starts = subtitleStarts(lines);
  let index = 0;
  for (let i = 0; i < starts.length; i += 1) {
    const start = starts[i];
    if (start !== undefined && progress >= start) index = i;
  }
  return index;
}
