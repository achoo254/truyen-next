/** Runs the planned build steps: the tools' health checks and each step's commands, with clear failures. */
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { type Scene, type StoryTrack, layOutTrack } from '@truyen/story';
import { type BuildStep, type Tools, probeCommand, toolPath, trackMixCommand } from './story-build-plan';
import { REPO_ROOT } from './story-files';

export const PC_OFFLINE = 'PC offline, pending';

export class BuildError extends Error {}

interface Ran {
  status: number | null;
  stdout: string;
  stderr: string;
}

function run(argv: readonly string[]): Ran {
  const [command, ...args] = argv;
  if (command === undefined) throw new BuildError('empty command');
  const result = spawnSync(command, args, { cwd: REPO_ROOT, encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 });
  if (result.error) throw new BuildError(`${command} could not start: ${result.error.message}`);
  return { status: result.status, stdout: result.stdout, stderr: result.stderr };
}

/** The `{"ok": false, "error": …}` line the artgen tools print, or the tail of stderr. */
function failureDetail(ran: Ran): string {
  const last = ran.stdout.trim().split('\n').at(-1) ?? '';
  try {
    const parsed: unknown = JSON.parse(last);
    if (typeof parsed === 'object' && parsed !== null && 'error' in parsed && typeof parsed.error === 'string') return parsed.error;
  } catch {
    // Not a JSON line: fall back to stderr below.
  }
  return (ran.stderr.trim() || last || `exit code ${ran.status}`).slice(-500);
}

/** Stops with PC_OFFLINE unless the tool's `--health` answers. */
export function requireHealthy(tools: Tools, script: 'artgen.py' | 'voice.py'): void {
  const ran = run([tools.python, toolPath(tools, script), '--health']);
  if (ran.status !== 0) throw new BuildError(`${PC_OFFLINE}: ${script} --health failed (${failureDetail(ran)})`);
}

export function runStep(step: BuildStep): void {
  for (const argv of step.commands) {
    for (const file of argv.slice(1)) {
      // Make the folder of every output path (-o …, and the converters' last argument).
      if (/^(\.work|stories)\//.test(file)) mkdirSync(path.dirname(path.join(REPO_ROOT, file)), { recursive: true });
    }
    const ran = run(argv);
    if (ran.status !== 0) throw new BuildError(`${step.id}: ${path.basename(argv[1] ?? argv[0] ?? '')} failed: ${failureDetail(ran)}`);
  }
  if (!existsSync(path.join(REPO_ROOT, step.output))) throw new BuildError(`${step.id}: finished without ${step.output}`);
}

/** Length of an audio file in seconds, read by ffprobe. */
export function probeSeconds(file: string): number {
  const ran = run(probeCommand(file));
  const value = Number.parseFloat(ran.stdout.trim());
  if (ran.status !== 0 || !Number.isFinite(value) || value <= 0) throw new BuildError(`ffprobe could not read the length of ${file}: ${failureDetail(ran)}`);
  return value;
}

/**
 * Makes the story recording of a planned `track` step: measures every voice, lays the scenes out (layOutTrack), mixes
 * them over the music, and returns what story.json records. `file` is the recording's path inside the story folder.
 */
export function makeStoryTrack(step: BuildStep, scenes: readonly Pick<Scene, 'id'>[], file: string): StoryTrack {
  if (!step.track) throw new BuildError(`${step.id}: not a story recording step`);
  const { voices, music } = step.track;
  const track = layOutTrack(file, scenes, voices.map((voice) => probeSeconds(voice)));
  const ran = run(trackMixCommand(voices, music, track, step.output));
  if (ran.status !== 0) throw new BuildError(`${step.id}: ffmpeg failed: ${failureDetail(ran)}`);
  const made = probeSeconds(step.output);
  // AAC frames round the end by a few milliseconds; anything more means the mix went wrong.
  if (Math.abs(made - track.duration) > 0.25) throw new BuildError(`${step.id}: the recording lasts ${made.toFixed(2)} s, expected ${track.duration} s`);
  return track;
}
