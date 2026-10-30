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
 * 6. track: the whole story as one recording (ffmpeg, no PC): each voice at its place over the music, which is turned
 *    down under the voice; the places are laid out from the measured voice lengths when the step runs;
 * 7. social: the upscaled clips joined with the title and the music by `video-finish.py`, a 30–60 s clip to post.
 *
 * Raw tool output lands in `.work/<slug>/` (gitignored); what the app serves is compressed into
 * `stories/<slug>/media/` (WebP, H.264 MP4 without sound, AAC M4A).
 */
import { type Story, type StoryTrack, estimateReadingSeconds, layOutTrack } from '@truyen/story';

export const STAGES = ['characters', 'images', 'videos', 'voices', 'music', 'track', 'social'] as const;
export type Stage = (typeof STAGES)[number];

/** Portrait sizes: stills 9:16 near Qwen's native pixel count, sheets 3:4, motion at Wan's 720p. */
export const SHEET_SIZE = '1104x1472';
export const STILL_SIZE = '864x1536';
export const MOTION_SIZE = '720x1280';
const WEBP_QUALITY = '88';
const VIDEO_CRF = '30';
/** The story recording, next to the music. */
export const TRACK_FILE = 'media/story.m4a';
/** The music bed's level in the recording, before it is turned down further under the voice. */
export const TRACK_MUSIC_VOLUME = '0.3';
/** How hard the voice pushes the music down (sidechaincompress): a soft knee, quick to duck, slow to come back. */
const DUCKING = 'threshold=0.02:ratio=8:attack=40:release=700:knee=4';

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
  /**
   * The story recording: its mix is laid out from the voice lengths measured when it runs (story-build-run.ts
   * makeStoryTrack); `commands` show it laid out from the estimated reading times, for --dry-run.
   */
  track?: { voices: string[]; music: string };
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

  if (stages.includes('track')) {
    const voices = story.scenes.map((scene) => media(`media/scenes/${scene.id}.m4a`));
    const music = media('media/music.m4a');
    const estimated = layOutTrack(TRACK_FILE, story.scenes, story.scenes.map((scene) => estimateReadingSeconds(scene.narration)));
    steps.push({
      id: 'track',
      stage: 'track',
      commands: [...voices.map((voice) => probeCommand(voice)), trackMixCommand(voices, music, estimated, media(TRACK_FILE))],
      inputs: [...voices, music],
      output: media(TRACK_FILE),
      pc: null,
      track: { voices, music },
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

/** Prints the length of an audio file in seconds. */
export function probeCommand(file: string): string[] {
  return ['ffprobe', '-v', 'error', '-show_entries', 'format=duration', '-of', 'default=noprint_wrappers=1:nokey=1', file];
}

const seconds = (value: number): string => String(Math.round(value * 1000) / 1000);

/**
 * The ffmpeg call that mixes the story recording: every voice delayed to its start in `track`, the music looped to the
 * recording's length at TRACK_MUSIC_VOLUME, faded in over the lead-in and out over the tail, and pushed down while a
 * voice speaks (sidechain compression keyed by the voices). Stereo AAC, like the music.
 */
export function trackMixCommand(voices: readonly string[], music: string, track: StoryTrack, output: string): string[] {
  if (voices.length !== track.scenes.length) throw new Error(`${track.scenes.length} scenes in the track but ${voices.length} voices`);
  const n = voices.length;
  const duration = track.duration;
  const lastEnd = track.scenes[n - 1]?.end ?? 0;
  const firstStart = track.scenes[0]?.start ?? 0;
  const format = 'aformat=sample_fmts=fltp:sample_rates=44100:channel_layouts=stereo';
  const placed = track.scenes.map((scene, i) => `[${i}:a]${format},adelay=delays=${Math.round(scene.start * 1000)}:all=1[v${i}]`);
  const voiceLabels = track.scenes.map((_scene, i) => `[v${i}]`).join('');
  const graph = [
    ...placed,
    `${voiceLabels}amix=inputs=${n}:duration=longest:normalize=0,apad,atrim=0:${seconds(duration)},asplit=2[say][key]`,
    `[${n}:a]${format},atrim=0:${seconds(duration)},volume=${TRACK_MUSIC_VOLUME},afade=t=in:d=${seconds(firstStart)},afade=t=out:st=${seconds(lastEnd)}:d=${seconds(duration - lastEnd)}[bed]`,
    `[bed][key]sidechaincompress=${DUCKING}[ducked]`,
    '[say][ducked]amix=inputs=2:duration=first:normalize=0,alimiter=limit=0.95[out]',
  ].join(';');
  return [
    'ffmpeg', '-y', '-v', 'error',
    ...voices.flatMap((voice) => ['-i', voice]),
    '-stream_loop', '-1', '-i', music,
    '-filter_complex', graph,
    '-map', '[out]', '-c:a', 'aac', '-b:a', '128k', '-ac', '2', '-movflags', '+faststart', output,
  ];
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
