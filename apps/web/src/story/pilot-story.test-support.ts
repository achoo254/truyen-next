import { type Story, validateStory } from '@truyen/story';
import pilotJson from '../../../../stories/son-tinh-thuy-tinh/story.json';

/** A fresh copy of the pilot story (stories/son-tinh-thuy-tinh), checked like the app checks it. */
export function pilotStory(): Story {
  const result = validateStory(structuredClone(pilotJson), 'son-tinh-thuy-tinh');
  if (!result.ok) throw new Error(result.errors.join('\n'));
  return result.story;
}
