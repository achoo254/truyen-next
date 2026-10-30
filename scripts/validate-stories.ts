/** `pnpm check:stories`: every stories/<slug>/story.json is valid and its media files exist. Exits 1 otherwise. */
import { estimateStorySeconds } from '@truyen/story';
import { loadStories } from './story-files';

const { stories, errors } = loadStories();
for (const { slug, story } of stories) {
  console.log(`✓ ${slug}: ${story.scenes.length} scenes, about ${Math.round(estimateStorySeconds(story))} s read aloud, ${story.status}`);
}
if (errors.length > 0) {
  console.error(`✗ ${errors.length} problem(s):`);
  for (const error of errors) console.error(`  ${error}`);
  process.exitCode = 1;
} else if (stories.length === 0) {
  console.error('✗ no story found under stories/');
  process.exitCode = 1;
}
