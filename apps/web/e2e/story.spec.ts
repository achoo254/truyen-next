import { readFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';
import { estimateReadingSeconds, validateStory } from '@truyen/story';

const STORY_FILE = new URL('../../../stories/son-tinh-thuy-tinh/story.json', import.meta.url);
const checked = validateStory(JSON.parse(readFileSync(STORY_FILE, 'utf8')), 'son-tinh-thuy-tinh');
if (!checked.ok) throw new Error(checked.errors.join('\n'));
/** The first scene's length on the browser timer (no recorded voice yet). */
const FIRST_SCENE_MS = estimateReadingSeconds(checked.story.scenes[0]?.narration ?? '') * 1000;

test('open the pilot story and step through it scene by scene', async ({ page }) => {
  const consoleErrors: string[] = [];
  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(message.text());
  });
  await page.goto('/');
  await expect(page.locator('[data-id=story-card-son-tinh-thuy-tinh]')).toContainText('Sơn Tinh, Thủy Tinh');
  await page.click('[data-id=story-open-son-tinh-thuy-tinh]');
  await expect(page).toHaveURL(/\/truyen\/son-tinh-thuy-tinh$/);
  await expect(page).toHaveTitle(/^Sơn Tinh, Thủy Tinh · /);
  await expect(page.locator('[data-id=story-no-media]')).toBeVisible();
  await expect(page.locator('[data-id=story-subtitle-line]')).toHaveText('Xin chào các bạn nhỏ! Mình là Mèo Miu đây.');

  // The scene clock runs on the browser timer: fast-forward it instead of waiting half a minute.
  await page.clock.install();
  await page.click('[data-id=story-play]');
  await page.clock.runFor(FIRST_SCENE_MS / 2);
  await expect(page.locator('[data-id=story-subtitle-line]')).not.toHaveText('Xin chào các bạn nhỏ! Mình là Mèo Miu đây.');
  await expect(page.locator('[data-id=story-scene-number]')).toContainText('Cảnh 1/8');
  await page.clock.runFor(FIRST_SCENE_MS / 2 + 1_000);
  await expect(page.locator('[data-id=story-scene-number]')).toContainText('Cảnh 2/8');

  await page.click('[data-id=story-play]');
  await page.click('[data-id=story-next]');
  await expect(page.locator('[data-id=story-scene-number]')).toContainText('Cảnh 3/8');
  await page.click('[data-id=story-prev]');
  await expect(page.locator('[data-id=story-scene-number]')).toContainText('Cảnh 2/8');
  await page.click('[data-id=story-mute]');
  await expect(page.locator('[data-id=story-mute]')).toHaveAttribute('aria-pressed', 'true');

  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(page.viewportSize()?.width ?? 0);
  await page.screenshot({ path: test.info().outputPath('story-scene-2.png'), fullPage: true });
  expect(consoleErrors).toEqual([]);
});
