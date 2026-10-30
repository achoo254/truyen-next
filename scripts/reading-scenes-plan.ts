/**
 * The calls that paint the reading-scene backdrops (packages/story/src/reading-scenes.ts) on the home PC, as data:
 * for each scene, mood and frame shape, one qwen drawing at the frame's draw size into `.work/reading-scenes/`,
 * then each export size resized with ffmpeg (Lanczos) and saved as AVIF (libaom, still picture) and WebP (cwebp)
 * under apps/web/public/reading-scenes/. Pure, so the tests pin every flag.
 */
import { BACKDROP_FRAMES, READING_SCENES, READING_SCENE_STYLE, type ReadingSceneId, type SceneMood, backdropUrl } from '@truyen/story';
import { type Tools, toolPath } from './story-build-plan';

export const BACKDROP_PUBLIC_DIR = 'apps/web/public';
const WORK = '.work/reading-scenes';
const AVIF_CRF = '34';
const WEBP_QUALITY = '80';

export interface BackdropStep {
  /** e.g. "ban-go:night:phone". */
  id: string;
  scene: ReadingSceneId;
  mood: SceneMood;
  commands: string[][];
  /** Every file the step makes (relative to the repository root); the step is done when they all exist. */
  outputs: string[];
}

/** The seed of a scene variant: stable, so a redraw of one frame matches the others. */
export function backdropSeed(scene: ReadingSceneId, mood: SceneMood): number {
  let hash = 2166136261;
  for (const char of `${scene}:${mood}`) hash = Math.imul(hash ^ char.charCodeAt(0), 16777619) >>> 0;
  return hash;
}

export function planReadingScenes(tools: Tools, only?: ReadingSceneId): BackdropStep[] {
  const steps: BackdropStep[] = [];
  for (const scene of READING_SCENES) {
    if (only && scene.id !== only) continue;
    for (const [mood, prompt] of Object.entries(scene.prompts) as Array<[SceneMood, string]>) {
      for (const frame of BACKDROP_FRAMES) {
        const raw = `${WORK}/${scene.id}-${mood}-${frame.id}.png`;
        const draw = [tools.python, toolPath(tools, 'artgen.py'), `${READING_SCENE_STYLE}. ${prompt}, ${frame.aspect} composition`, '-w', 'qwen'];
        draw.push('--size', frame.draw, '--seed', String(backdropSeed(scene.id, mood)), '-o', raw);
        const commands = [draw];
        const outputs: string[] = [];
        for (const size of frame.exports) {
          const [width, height] = size.split('x');
          const resized = `${WORK}/${scene.id}-${mood}-${size}.png`;
          const avif = `${BACKDROP_PUBLIC_DIR}${backdropUrl(scene.id, mood, size, 'avif')}`;
          const webp = `${BACKDROP_PUBLIC_DIR}${backdropUrl(scene.id, mood, size, 'webp')}`;
          commands.push(['ffmpeg', '-y', '-v', 'error', '-i', raw, '-vf', `scale=${width}:${height}:flags=lanczos`, resized]);
          commands.push(['ffmpeg', '-y', '-v', 'error', '-i', resized, '-c:v', 'libaom-av1', '-still-picture', '1', '-crf', AVIF_CRF, '-cpu-used', '4', avif]);
          commands.push(['cwebp', '-quiet', '-q', WEBP_QUALITY, resized, '-o', webp]);
          outputs.push(avif, webp);
        }
        steps.push({ id: `${scene.id}:${mood}:${frame.id}`, scene: scene.id, mood, commands, outputs });
      }
    }
  }
  return steps;
}
