import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { PC_OFFLINE, requireHealthy, runStep } from './story-build-run';
import { REPO_ROOT } from './story-files';

const dirs: string[] = [];
/** A stand-in for the inet-artgen folder whose tools print `stdout` and exit with `code`. */
function fakeTools(stdout: string, code: number): { python: string; artgenDir: string } {
  const dir = mkdtempSync(path.join(tmpdir(), 'truyen-artgen-'));
  dirs.push(dir);
  const script = `import sys\nprint(${JSON.stringify(stdout)})\nsys.exit(${code})\n`;
  for (const name of ['artgen.py', 'voice.py']) writeFileSync(path.join(dir, name), script);
  return { python: 'python3', artgenDir: dir };
}
afterEach(() => {
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
  rmSync(path.join(REPO_ROOT, '.work/test'), { recursive: true, force: true });
});

describe('story build runner', () => {
  it('stops with "PC offline, pending" and the tool message when the health check fails', () => {
    const tools = fakeTools('{"ok": false, "error": "PC offline or ComfyUI not running at http://hoandat-pc"}', 1);
    expect(() => requireHealthy(tools, 'artgen.py')).toThrow(`${PC_OFFLINE}: artgen.py --health failed (PC offline or ComfyUI not running at http://hoandat-pc)`);
    expect(() => requireHealthy(tools, 'voice.py')).toThrow(/^PC offline, pending: voice\.py --health failed/);
  });

  it('passes when the health check answers', () => {
    expect(() => requireHealthy(fakeTools('{"ok": true}', 0), 'artgen.py')).not.toThrow();
  });

  it('names the step and the tool error when a command fails', () => {
    const tools = fakeTools('{"ok": false, "error": "ComfyUI error: out of memory"}', 1);
    const step = {
      id: 'videos:mo-dau',
      stage: 'videos' as const,
      commands: [[tools.python, path.join(tools.artgenDir, 'artgen.py'), 'x', '-o', '.work/test/x.mp4']],
      inputs: [],
      output: '.work/test/x.mp4',
      pc: 'artgen' as const,
    };
    expect(() => runStep(step)).toThrow('videos:mo-dau: artgen.py failed: ComfyUI error: out of memory');
  });
});
