/**
 * Reading scenes: the place the open book lies in while a story is read (a desk by the window, a bed at night, a
 * temple yard under the moon…). The backdrop only frames the book: no word is ever printed on it, and the book's
 * pages stay opaque, so the subtitles read the same on every scene.
 *
 * Until the home PC paints them, each scene is drawn by CSS (apps/web/src/ui/app.css, `.backdrop--<id>`). The
 * paintings are planned from this file (scripts/build-reading-scenes.ts, docs/reading-scenes.md): one prompt per
 * scene and mood, drawn for four frame shapes and exported at the sizes below as AVIF with a WebP fallback. A
 * scene variant shows its painting once `drawn` lists it.
 */

export const READING_SCENE_IDS = ['ban-go', 'giuong-ngu', 'san-dinh-trang', 'goc-da', 'vong-hien', 'hien-mua', 'ben-sen', 'giay-tron'] as const;
export type ReadingSceneId = (typeof READING_SCENE_IDS)[number];
export type SceneMood = 'day' | 'night';

/** The desk by the window is where every shelf starts. */
export const DEFAULT_READING_SCENE: ReadingSceneId = 'ban-go';
/** Plain paper: no backdrop, what Save-Data and slow connections get. */
export const PLAIN_READING_SCENE: ReadingSceneId = 'giay-tron';

export interface ReadingScene {
  id: ReadingSceneId;
  name: { vi: string; en: string };
  /** The prompt of each mood it is painted in (without the shared style, READING_SCENE_STYLE). Plain paper: none. */
  prompts: Partial<Record<SceneMood, string>>;
  /** The variants painted so far (their files exist under apps/web/public/reading-scenes/). */
  drawn: readonly SceneMood[];
}

/**
 * Put before every prompt: the look of an Đông Hồ print, and the empty middle where the book will lie. Painted
 * with qwen (no lettering in these pictures).
 */
export const READING_SCENE_STYLE =
  "Vietnamese Đông Hồ woodblock print style, flat colour fields, bold hand-carved black keylines, limited palette of vermilion red, turmeric yellow, leaf green, charcoal black and warm wood brown, on shimmering điệp shell paper texture, top-down three-quarter view, calm, no text, no letters, no people's faces in close-up, large plain uncluttered central area reserved for an open book, props only near the edges and corners";

export const READING_SCENES: readonly ReadingScene[] = [
  {
    id: 'ban-go',
    name: { vi: 'Bàn gỗ bên cửa sổ', en: 'Desk by the window' },
    prompts: {
      day: 'a warm wooden study desk by a lattice window, morning light, a small clay teapot and one cup at the top right, a sprig of peach blossom in a vase at the top left, plain wood grain in the centre',
      night: 'the same wooden study desk by a lattice window at night, a brass oil lamp at the top right casting a warm circle of light, deep brown shadows, plain wood grain in the centre',
    },
    drawn: [],
  },
  {
    id: 'giuong-ngu',
    name: { vi: 'Trên giường', en: 'In bed' },
    prompts: {
      night: "a child's bed seen from above at night, a patterned quilt with lotus motifs, a pillow at the top, a crescent-moon night light glowing amber at the top left, a sleeping cat curled at the bottom corner, plain quilt surface in the centre",
    },
    drawn: [],
  },
  {
    id: 'san-dinh-trang',
    name: { vi: 'Sân đình đêm trăng sao', en: 'Temple yard under the moon' },
    prompts: {
      night: 'a village communal house courtyard at night under a full moon and many stars, a star lantern at the top right, banyan leaves at the edges, plain brick-tiled ground in the centre',
    },
    drawn: [],
  },
  {
    id: 'goc-da',
    name: { vi: 'Công viên dưới gốc đa', en: 'Park under the banyan' },
    prompts: {
      day: 'a village park lawn under a great banyan tree in late afternoon, aerial roots hanging along the top edge, a few fallen leaves and a buffalo far away at the bottom corner, plain grass in the centre',
    },
    drawn: [],
  },
  {
    id: 'vong-hien',
    name: { vi: 'Võng dưới hiên tre', en: 'Hammock on the porch' },
    prompts: {
      day: 'a hammock under a bamboo porch at summer noon, dappled leaf shadows, a hand fan and a bowl of rambutan at the bottom edge, plain woven hammock surface in the centre',
    },
    drawn: [],
  },
  {
    id: 'hien-mua',
    name: { vi: 'Hiên nhà ngày mưa', en: 'Porch in the rain' },
    prompts: {
      day: 'a tiled porch in the rain, rows of raindrops falling from curved roof tiles along the top edge, a wet clay jar at a corner, plain wooden floor in the centre',
      night: 'a tiled porch in the rain at night, rows of raindrops falling from curved roof tiles along the top edge, one oil lamp lit at a corner, a wet clay jar, plain wooden floor in the centre',
    },
    drawn: [],
  },
  {
    id: 'ben-sen',
    name: { vi: 'Thuyền bên đầm sen', en: 'Boat on the lotus pond' },
    prompts: {
      day: 'a small bamboo boat on a lotus pond, lotus leaves and pink blossoms around the edges, plain boat floor in the centre',
    },
    drawn: [],
  },
  { id: 'giay-tron', name: { vi: 'Giấy trơn', en: 'Plain paper' }, prompts: {}, drawn: [] },
];

export function readingScene(id: ReadingSceneId): ReadingScene {
  const scene = READING_SCENES.find((each) => each.id === id);
  if (!scene) throw new Error(`no reading scene ${id}`);
  return scene;
}

export const isReadingSceneId = (value: unknown): value is ReadingSceneId => (READING_SCENE_IDS as readonly unknown[]).includes(value);

/**
 * The mood to show: night when the lights are off and the scene has a night variant, its only mood otherwise. A
 * night-only scene stays night with the lights on (the pages stay paper under a lamp); nothing changes the
 * reader's lights for them.
 */
export function sceneMood(scene: ReadingScene, lightsOff: boolean): SceneMood | null {
  const moods = Object.keys(scene.prompts) as SceneMood[];
  if (moods.length === 0) return null;
  if (lightsOff && moods.includes('night')) return 'night';
  return moods.includes('day') ? 'day' : 'night';
}

/**
 * The four frame shapes each variant is painted in, and the sizes exported from each. `draw` is the size asked of
 * the model (multiples of 16, near its native pixel count); the exports are resized from it.
 */
export const BACKDROP_FRAMES = [
  { id: 'phone', aspect: '9:19.5', draw: '832x1808', exports: ['1125x2436', '750x1624'], budgetKb: { avif: 90, webp: 140 } },
  { id: 'tablet-portrait', aspect: '3:4', draw: '1104x1472', exports: ['1536x2048'], budgetKb: { avif: 150, webp: 230 } },
  { id: 'tablet-landscape', aspect: '4:3', draw: '1472x1104', exports: ['2048x1536'], budgetKb: { avif: 150, webp: 230 } },
  { id: 'desktop', aspect: '16:9', draw: '1664x928', exports: ['2560x1440', '1920x1080'], budgetKb: { avif: 220, webp: 350 } },
] as const;
export type BackdropFrame = (typeof BACKDROP_FRAMES)[number];

/** Where an exported backdrop lives on the site, e.g. /reading-scenes/ban-go-night-1125x2436.avif. */
export function backdropUrl(id: ReadingSceneId, mood: SceneMood, size: string, format: 'avif' | 'webp'): string {
  return `/reading-scenes/${id}-${mood}-${size}.${format}`;
}
