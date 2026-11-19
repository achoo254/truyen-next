/**
 * Listens to recordings with the speech-recognition check (asr-check.py: faster-whisper, Vietnamese) and scores each
 * one against the text it should say. The check runs where the model is, so its two paths come from the environment
 * and nothing about the machine lives in the repository:
 *
 *   ASR_PYTHON  the Python that has faster-whisper installed
 *   ASR_CHECK   the asr-check.py script
 *
 * Without both, `asrConfigFromEnv` returns null and the caller says the voices were not checked.
 */
import { spawnSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';

export interface AsrConfig {
  python: string;
  script: string;
}

/** One recording: what it should say, what the check heard, and how close they are (1 is identical). */
export interface AsrResult {
  file: string;
  expected: string;
  heard: string;
  accuracy: number;
}

export function asrConfigFromEnv(env: NodeJS.ProcessEnv = process.env): AsrConfig | null {
  const { ASR_PYTHON: python, ASR_CHECK: script } = env;
  return python && script ? { python, script } : null;
}

/** The result lines asr-check.py prints (one JSON object per clip); anything else it prints is ignored. */
export function parseAsrOutput(stdout: string): AsrResult[] {
  const results: AsrResult[] = [];
  for (const line of stdout.split('\n')) {
    if (!line.startsWith('{')) continue;
    try {
      const parsed: unknown = JSON.parse(line);
      if (typeof parsed !== 'object' || parsed === null) continue;
      const { file, expected, heard, syllable_accuracy: accuracy } = parsed as Record<string, unknown>;
      if (typeof file === 'string' && typeof expected === 'string' && typeof heard === 'string' && typeof accuracy === 'number') {
        results.push({ file, expected, heard, accuracy });
      }
    } catch {
      // Not a result line.
    }
  }
  return results;
}

/** The clips that score below `min`. */
export const belowMinimum = (results: readonly AsrResult[], min: number): AsrResult[] => results.filter((result) => result.accuracy < min);

/**
 * Scores `clips` (audio file, expected text) with the check. `workDir` receives the job list the script reads.
 * Throws when the script produced no result for a clip, so a broken check is never mistaken for a clean one.
 */
export function checkClips(config: AsrConfig, clips: readonly (readonly [string, string])[], workDir: string): AsrResult[] {
  if (clips.length === 0) return [];
  mkdirSync(workDir, { recursive: true });
  const jobs = path.join(workDir, 'asr-jobs.json');
  writeFileSync(jobs, JSON.stringify(clips));
  const ran = spawnSync(config.python, [config.script, jobs], { encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 });
  if (ran.error) throw new Error(`the speech check could not start: ${ran.error.message}`);
  const results = parseAsrOutput(ran.stdout);
  // Exit code 1 only means some clip scored under the script's own minimum; that is for the caller to judge.
  if (results.length !== clips.length) throw new Error(`the speech check scored ${results.length} of ${clips.length} clips: ${(ran.stderr || ran.stdout).trim().slice(-300)}`);
  return results;
}
