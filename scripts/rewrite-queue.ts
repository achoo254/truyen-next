/**
 * `pnpm story:rewrite-queue [count] [--shard i/n]`: the stories still waiting to be retold whole, in the order the
 * routine takes them (rewrite-queue-plan.ts), and how many are left. Prints the first `count` (default 10). With
 * `--shard`, only that shard's stories, so parallel runs split the queue without picking the same story.
 */
import { parseShard, rewriteQueue } from './rewrite-queue-plan';
import { loadStories } from './story-files';

const args = process.argv.slice(2);
const shardAt = args.indexOf('--shard');
const shardText = shardAt >= 0 ? args.splice(shardAt, 2)[1] : undefined;
const shard = shardText === undefined ? undefined : parseShard(shardText);
if (shard === null) {
  console.error(`✗ --shard expects i/n with i < n, got "${shardText ?? ''}"`);
  process.exit(1);
}
const count = Number(args[0] ?? 10);
const { stories } = loadStories();
const all = rewriteQueue(stories);
const queue = shard ? rewriteQueue(stories, shard) : all;
console.log(`${all.length} of ${stories.length} stories still to rewrite${shard ? `, ${queue.length} in shard ${shard.index}/${shard.count}` : ''}`);
for (const item of queue.slice(0, Number.isFinite(count) && count > 0 ? count : 10)) {
  console.log(`${item.slug} (${item.shelf}, about ${item.seconds} s)`);
}
