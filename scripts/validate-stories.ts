/**
 * `pnpm check:stories`: every stories/<slug>/story.json is valid and its media files exist, and catalog/stories.json
 * is sound and agrees with the stories (docs/story-routine.md). Exits 1 on an error; catalog warnings (a story
 * folder the catalog does not list yet, an `idea` that is already written) are printed but do not fail.
 */
import { estimateStorySeconds } from '@truyen/story';
import { type StoryFacts, checkCatalog, readCatalog, storyStatus } from './story-catalog';
import { loadStories, storyFolders } from './story-files';

const { stories, errors } = loadStories();
for (const { slug, story } of stories) {
  console.log(`✓ ${slug} (${story.shelf}): ${story.scenes.length} scenes, about ${Math.round(estimateStorySeconds(story))} s read aloud`);
}

const facts = new Map<string, StoryFacts | null>(storyFolders().map((slug) => [slug, null]));
for (const { slug, story } of stories) facts.set(slug, { shelf: story.shelf, title: story.title, status: storyStatus(story) });
const catalog = readCatalog();
if (catalog.error) {
  errors.push(catalog.error);
} else {
  const report = checkCatalog(catalog.data, facts);
  errors.push(...report.errors);
  const ideas = report.entries.filter((entry) => entry.status === 'idea').length;
  console.log(`✓ catalog: ${report.entries.length} entries, ${ideas} still ideas`);
  for (const warning of report.warnings) console.warn(`! ${warning}`);
}

if (errors.length > 0) {
  console.error(`✗ ${errors.length} problem(s):`);
  for (const error of errors) console.error(`  ${error}`);
  process.exitCode = 1;
} else if (stories.length === 0) {
  console.error('✗ no story found under stories/');
  process.exitCode = 1;
}
