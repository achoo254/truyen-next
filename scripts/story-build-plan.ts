/**
 * The calls that turn an approved story.json into media, as data: which tool runs with which arguments, what each
 * step needs and makes, and which story.json field it fills. `build-story.ts` prints or runs them; keeping the
 * plan pure lets the tests pin every flag sent to the PC.
 *
 * Per story (tools: artgen.py, voice.py, video-finish.py of the inet-artgen skill, ffmpeg and cwebp locally):
 * 1. characters: each sheet drawn once (`qwen`, or `klein-edit --ref` from an existing picture);
 * 2. images: each scene still, `klein-edit --ref <character sheet>` so the characters stay alike;
 * 3. videos: `wan-i2v` gentle motion from the still at 720×1280, then `video-upscale` to 1080×1920;
 * 4. voices: `voice.py` with the scene narrator's voice;
 * 5. music: one `ace-music` instrumental bed for the whole story;
 * 6. social: the upscaled clips joined with the title and the music by `video-finish.py`, a 30–60 s clip to post.
 *
 * Raw tool output lands in `.work/<slug>/` (gitignored); what the app serves is compressed into
 * `stories/<slug>/media/` (WebP, H.264 MP4 without sound, AAC M4A).
 */
import type { Story } from '@truyen/story';

export const STAGES = ['characters', 'images', 'videos', 'voices', 'music', 'social'] as const;
export type Stage = (typeof STAGES)[number];

/** Portrait sizes: stills 9:16 near Qwen's native pixel count, sheets 3:4, motion at Wan's 720p. */
export const SHEET_SIZE = '1104x1472';
export const STILL_SIZE = '864x1536';
export const MOTION_SIZE = '720x1280';
const WEBP_QUALITY = '88';
const VIDEO_CRF = '30';

/** The story field a step fills once its file exists. */
export type MediaRecord = { kind: 'character' | 'image' | 'video' | 'voice'; id: string; file: string } | { kind: 'music'; file: string };

export interface BuildStep {
  /** e.g. "images:mo-dau". */
  id: string;
  stage: Stage;
  /** Commands run in order (argv, paths relative to the repository root). The first is a PC call or video-finish. */
  commands: string[][];
  /** Files (relative to the repository root) that must exist before the step runs. */
  inputs: string[];
  /** The file the step makes; the step is skipped when it exists (unless forced). */
  output: string;
  record?: MediaRecord;
  /** Uses the PC (artgen.py or voice.py) rather than only local tools. */
  pc: 'artgen' | 'voice' | null;
}

export interface Tools {
  python: string;
  /** Folder of artgen.py, voice.py and video-finish.py. */
  artgenDir: string;
}

export function toolPath(tools: Tools, script: 'artgen.py' | 'voice.py' | 'video-finish.py'): string {
  return `${tools.artgenDir.replace(/\/+$/, '')}/${script}`;
}

function stylePrompt(prompt: string, style: string): string {
  return `${prompt.replace(/[.\s]+$/, '')}. ${style}`;
}

export function planStoryBuild(story: Story, tools: Tools, stages: readonly Stage[] = STAGES): BuildStep[] {
  const storyDir = `stories/${story.slug}`;
  const work = `.work/${story.slug}`;
  const artgen = [tools.python, toolPath(tools, 'artgen.py')];
  const media = (file: string): string => `${storyDir}/${file}`;
  const webp = (input: string, output: string): string[] => ['cwebp', '-quiet', '-q', WEBP_QUALITY, input, '-o', output];
  const aac = (input: string, output: string, bitrate: string, channels: string): string[] => [
    'ffmpeg', '-y', '-v', 'error', '-i', input, '-c:a', 'aac', '-b:a', bitrate, '-ac', channels, '-movflags', '+faststart', output,
  ];
  const sheetFile = (id: string): string => `media/characters/${id}.webp`;
  const stillRaw = (id: string): string => `${work}/scenes/${id}.png`;
  const clip1080 = (id: string): string => `${work}/scenes/${id}-1080.mp4`;
  const musicRaw = `${work}/music.mp3`;
  const steps: BuildStep[] = [];

  if (stages.includes('characters')) {
    for (const character of story.characters) {
      const raw = `${work}/characters/${character.id}.png`;
      const file = sheetFile(character.id);
      const draw = [...artgen, stylePrompt(character.sheetPrompt, story.style)];
      draw.push(...(character.refImage ? ['-w', 'klein-edit', '--ref', character.refImage] : ['-w', 'qwen']));
      draw.push('--size', SHEET_SIZE, '--seed', String(character.seed), '-o', raw);
      steps.push({
        id: `characters:${character.id}`,
        stage: 'characters',
        commands: [draw, webp(raw, media(file))],
        inputs: character.refImage ? [character.refImage] : [],
        output: media(file),
        record: { kind: 'character', id: character.id, file },
        pc: 'artgen',
      });
    }
  }

  for (const scene of story.scenes) {
    if (stages.includes('images')) {
      const file = `media/scenes/${scene.id}.webp`;
      const sheet = scene.image.character ? media(sheetFile(scene.image.character)) : null;
      const draw = [...artgen, stylePrompt(`${scene.image.prompt}, vertical 9:16 composition`, story.style)];
      draw.push(...(sheet ? ['-w', 'klein-edit', '--ref', sheet] : ['-w', 'qwen']));
      draw.push('--size', STILL_SIZE, '--seed', String(scene.image.seed), '-o', stillRaw(scene.id));
      steps.push({
        id: `images:${scene.id}`,
        stage: 'images',
        commands: [draw, webp(stillRaw(scene.id), media(file))],
        inputs: sheet ? [sheet] : [],
        output: media(file),
        record: { kind: 'image', id: scene.id, file },
        pc: 'artgen',
      });
    }
    if (stages.includes('videos')) {
      const file = `media/scenes/${scene.id}.mp4`;
      // The committed still, not the raw PNG in .work/, so the motion can be made on another machine.
      const still = media(`media/scenes/${scene.id}.webp`);
      const clip720 = `${work}/scenes/${scene.id}-720.mp4`;
      steps.push({
        id: `videos:${scene.id}`,
        stage: 'videos',
        commands: [
          [...artgen, scene.video.motionPrompt, '-w', 'wan-i2v', '--ref', still, '--size', MOTION_SIZE, '--seed', String(scene.video.seed), '-o', clip720],
          [...artgen, '-', '-w', 'video-upscale', '--ref', clip720, '-o', clip1080(scene.id)],
          ['ffmpeg', '-y', '-v', 'error', '-i', clip1080(scene.id), '-an', '-c:v', 'libx264', '-preset', 'slow', '-crf', VIDEO_CRF, '-pix_fmt', 'yuv420p', '-movflags', '+faststart', media(file)],
        ],
        inputs: [still],
        output: media(file),
        record: { kind: 'video', id: scene.id, file },
        pc: 'artgen',
      });
    }
    if (stages.includes('voices')) {
      const narrator = story.narrators[scene.narrator];
      if (!narrator) throw new Error(`scene ${scene.id}: narrator "${scene.narrator}" is not in narrators`);
      const file = `media/scenes/${scene.id}.m4a`;
      const raw = `${work}/scenes/${scene.id}.wav`;
      steps.push({
        id: `voices:${scene.id}`,
        stage: 'voices',
        commands: [[tools.python, toolPath(tools, 'voice.py'), scene.narration, '-o', raw, '--voice', narrator.voice], aac(raw, media(file), '64k', '1')],
        inputs: [],
        output: media(file),
        record: { kind: 'voice', id: scene.id, file },
        pc: 'voice',
      });
    }
  }

  if (stages.includes('music')) {
    const file = 'media/music.m4a';
    steps.push({
      id: 'music',
      stage: 'music',
      commands: [
        [...artgen, story.music.prompt, '-w', 'ace-music', '--duration', String(story.music.durationSeconds), '--seed', String(story.music.seed), '-o', musicRaw],
        aac(musicRaw, media(file), '128k', '2'),
      ],
      inputs: [],
      output: media(file),
      record: { kind: 'music', file },
      pc: 'artgen',
    });
  }

  if (stages.includes('social')) {
    const clips = story.scenes.map((scene) => clip1080(scene.id));
    steps.push({
      id: 'social',
      stage: 'social',
      commands: [[tools.python, toolPath(tools, 'video-finish.py'), ...clips, '--text', story.title, '--music', musicRaw, '-o', `${work}/social.mp4`]],
      inputs: [...clips, musicRaw],
      output: `${work}/social.mp4`,
      pc: null,
    });
  }
  return steps;
}

/** Fills the story field of a finished step (a new object; the input is not changed). */
export function applyRecord(story: Story, record: MediaRecord): Story {
  switch (record.kind) {
    case 'character':
      return { ...story, characters: story.characters.map((c) => (c.id === record.id ? { ...c, file: record.file } : c)) };
    case 'music':
      return { ...story, music: { ...story.music, file: record.file } };
    case 'image':
      return { ...story, scenes: story.scenes.map((s) => (s.id === record.id ? { ...s, image: { ...s.image, file: record.file } } : s)) };
    case 'video':
      return { ...story, scenes: story.scenes.map((s) => (s.id === record.id ? { ...s, video: { ...s.video, file: record.file } } : s)) };
    case 'voice':
      return { ...story, scenes: story.scenes.map((s) => (s.id === record.id ? { ...s, voice: { ...s.voice, file: record.file } } : s)) };
  }
}

/** A command as it would be typed in a POSIX shell. */
export function shellQuote(argv: readonly string[]): string {
  return argv.map((arg) => (/^[\w@%+=:,./-]+$/.test(arg) ? arg : `'${arg.replace(/'/g, `'\\''`)}'`)).join(' ');
}
