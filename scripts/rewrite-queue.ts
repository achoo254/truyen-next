/**
 * `pnpm story:rewrite-queue [count]`: the stories still waiting to be retold whole, in the order the routine takes
 * them (rewrite-queue-plan.ts), and how many are left. Prints the first `count` (default 10).
 */
import { rewriteQueue } from './rewrite-queue-plan';
import { loadStories } from './story-files';

const count = Number(process.argv[2] ?? 10);
const { stories } = loadStories();
const queue = rewriteQueue(stories);
console.log(`${queue.length} of ${stories.length} stories still to rewrite`);
for (const item of queue.slice(0, Number.isFinite(count) && count > 0 ? count : 10)) {
  console.log(`${item.slug} (${item.shelf}, about ${item.seconds} s)`);
}
