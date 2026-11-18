import { type Story, validateStory } from '@truyen/story';
import pilotJson from '../../../../packages/story/test-fixtures/pilot-story.json';

/**
 * A fresh copy of the pilot story as it was before any media existed (packages/story/test-fixtures), checked like the
 * app checks it. The tests need a story with no pictures or voices, which stories/son-tinh-thuy-tinh no longer is.
 */
export function pilotStory(): Story {
  const result = validateStory(structuredClone(pilotJson), 'son-tinh-thuy-tinh');
  if (!result.ok) throw new Error(result.errors.join('\n'));
  return result.story;
}
