/**
 * `pnpm scenes:build [<scene id>] [--dry-run] [--force]`: paints the reading-scene backdrops on the home PC
 * (reading-scenes-plan.ts) and exports them for the site. Needs the PC online (`artgen.py --health`), ffmpeg with
 * libaom and cwebp. Steps whose files all exist are skipped. Once a variant's files are in, add its mood to `drawn`
 * in packages/story/src/reading-scenes.ts, check the pictures (docs/reading-scenes.md) and commit both.
 */
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync } from 'node:fs';
import { homedir } from 'node:os';
import path from 'node:path';
import { parseArgs } from 'node:util';
import { isReadingSceneId } from '@truyen/story';
import { planReadingScenes } from './reading-scenes-plan';
import { shellQuote, toolPath } from './story-build-plan';
import { BuildError, requireHealthy } from './story-build-run';
import { REPO_ROOT } from './story-files';

function main(): void {
  const { values, positionals } = parseArgs({
    allowPositionals: true,
    options: { 'dry-run': { type: 'boolean', default: false }, force: { type: 'boolean', default: false } },
  });
  const [only, ...extra] = positionals;
  if (extra.length > 0 || (only !== undefined && !isReadingSceneId(only))) throw new BuildError('usage: pnpm scenes:build [<scene id>] [--dry-run] [--force]');
  const tools = {
    python: process.env.PYTHON ?? (process.platform === 'win32' ? 'python' : 'python3'),
    artgenDir: process.env.ARTGEN_DIR ?? path.join(homedir(), '.claude', 'skills', 'inet-artgen'),
  };
  const steps = planReadingScenes(tools, only !== undefined && isReadingSceneId(only) ? only : undefined);
  const done = (outputs: string[]): boolean => !values.force && outputs.every((file) => existsSync(path.join(REPO_ROOT, file)));

  if (values['dry-run']) {
    console.log(`# ${steps.length} drawings; the PC is checked first: ${shellQuote([tools.python, toolPath(tools, 'artgen.py'), '--health'])}`);
    for (const step of steps) {
      console.log(`\n# ${step.id}${done(step.outputs) ? ' (done, skipped)' : ''}`);
      for (const argv of step.commands) console.log(shellQuote(argv));
    }
    return;
  }

  const todo = steps.filter((step) => !done(step.outputs));
  if (todo.length === 0) {
    console.log('every planned backdrop exists');
    return;
  }
  requireHealthy(tools, 'artgen.py');
  for (const [index, step] of todo.entries()) {
    console.log(`[${index + 1}/${todo.length}] ${step.id}`);
    for (const argv of step.commands) {
      const output = argv.at(-1);
      if (output) mkdirSync(path.dirname(path.join(REPO_ROOT, output)), { recursive: true });
      const [command, ...args] = argv;
      if (command === undefined) throw new BuildError('empty command');
      const ran = spawnSync(command, args, { cwd: REPO_ROOT, encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 });
      if (ran.error) throw new BuildError(`${command} could not start: ${ran.error.message}`);
      if (ran.status !== 0) throw new BuildError(`${step.id}: ${path.basename(args[0] ?? command)} failed: ${(ran.stderr || ran.stdout).trim().slice(-500)}`);
    }
  }
  console.log(`${todo.length} drawing(s) done; check them (docs/reading-scenes.md), then list the moods in "drawn".`);
}

try {
  main();
} catch (error) {
  console.error(error instanceof BuildError ? error.message : error);
  process.exitCode = 1;
}
