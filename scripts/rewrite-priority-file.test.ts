import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { parseRewritePriority, readRewritePriority, writeRewritePriority } from './rewrite-priority-file';

const dir = mkdtempSync(path.join(tmpdir(), 'rewrite-priority-'));

describe('rewrite priority file', () => {
  it('reads nothing when the file is missing', () => {
    expect(readRewritePriority(path.join(dir, 'missing.json'))).toEqual([]);
  });

  it('writes and reads back the slugs in order', () => {
    const file = path.join(dir, 'ok.json');
    writeRewritePriority({ updated: '2026-11-16', slugs: ['tam-cam', 'hoang-tu-ran'] }, file);
    expect(readRewritePriority(file)).toEqual(['tam-cam', 'hoang-tu-ran']);
    expect(JSON.parse(readFileSync(file, 'utf8'))).toEqual({ updated: '2026-11-16', slugs: ['tam-cam', 'hoang-tu-ran'] });
  });

  it('writes an empty list as valid JSON', () => {
    const file = path.join(dir, 'empty.json');
    writeRewritePriority({ updated: '2026-11-16', slugs: [] }, file);
    expect(readRewritePriority(file)).toEqual([]);
  });

  it('refuses a malformed file instead of reordering the queue silently', () => {
    const file = path.join(dir, 'bad.json');
    writeFileSync(file, JSON.stringify({ updated: '16/11', slugs: ['Tấm Cám'] }));
    expect(() => readRewritePriority(file)).toThrow(/updated/);
    expect(() => parseRewritePriority({ updated: '2026-11-16', slugs: ['Tấm Cám'] })).toThrow(/slugs/);
  });
});
