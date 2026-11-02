import { DrizzleQueryError } from 'drizzle-orm/errors';
import { describe, expect, it } from 'vitest';
import { safeErrorText } from './log-error';

describe('error text for the journal', () => {
  it('drops the parameters of a failed query', () => {
    const cause = Object.assign(new Error('relation "saved_stories" does not exist'), { code: '42P01' });
    const error = new DrizzleQueryError('insert into "reading_progress" ("slug", "scene_index") values ($1, $2)', ['tam-cam-bi-mat', 1990], cause);
    expect(error.message).toContain('tam-cam-bi-mat');
    const text = safeErrorText(error);
    expect(text).toBe('query failed: Error 42P01 relation "saved_stories" does not exist');
    expect(text).not.toContain('tam-cam-bi-mat');
    expect(text).not.toContain('1990');
  });

  it('keeps name and message of other errors', () => {
    expect(safeErrorText(new TypeError('x is not a function'))).toBe('TypeError: x is not a function');
    expect(safeErrorText('weird')).toBe('string');
  });
});
