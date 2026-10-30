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
  // The children's shelf alone, the way in from Miu World.
  await page.goto('/tre-em');
  await expect(page.locator('h1')).toHaveText('Cổ tích Việt Nam cho bé');
  await expect(page.locator('[data-id=shelf-adults]')).toHaveCount(0);
  await expect(page.locator('[data-id=story-card-son-tinh-thuy-tinh]')).toContainText('Sơn Tinh, Thủy Tinh');
  await page.click('[data-id=story-open-son-tinh-thuy-tinh]');
  await expect(page).toHaveURL(/\/truyen\/son-tinh-thuy-tinh$/);
  await expect(page).toHaveTitle(/^Sơn Tinh, Thủy Tinh · /);
  await expect(page.locator('[data-id=story-shelf]')).toHaveText('Kệ Trẻ em');
  await expect(page.locator('[data-id=story-back]')).toHaveAttribute('href', '/tre-em');
  // The story's page, then the reader filling the screen: picture, subtitles and play in the first screenful.
  await page.click('[data-id=story-open-reader]');
  await expect(page.locator('[data-id=story-no-media]')).toBeVisible();
  for (const id of ['story-picture', 'story-subtitle-line', 'story-play']) {
    const box = await page.locator(`[data-id=${id}]`).boundingBox();
    expect(box && box.y + box.height).toBeLessThanOrEqual(page.viewportSize()?.height ?? 0);
  }
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
  await page.keyboard.press('ArrowRight');
  await expect(page.locator('[data-id=story-scene-number]')).toContainText('Cảnh 3/8');
  // A swipe to the left turns on.
  const book = await page.locator('.book').boundingBox();
  if (!book) throw new Error('no book');
  const y = book.y + book.height / 2;
  await page.mouse.move(book.x + book.width * 0.8, y);
  await page.mouse.down();
  await page.mouse.move(book.x + book.width * 0.2, y, { steps: 4 });
  await page.mouse.up();
  await expect(page.locator('[data-id=story-scene-number]')).toContainText('Cảnh 4/8');
  // No voice or music yet, so nothing to mute.
  await expect(page.locator('[data-id=story-mute]')).toHaveCount(0);

  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(page.viewportSize()?.width ?? 0);
  await page.screenshot({ path: test.info().outputPath('story-scene-2.png'), fullPage: true });
  expect(consoleErrors).toEqual([]);
});

test('the home page shows the children\'s shelf first, then the adults\' shelf', async ({ page }) => {
  const consoleErrors: string[] = [];
  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(message.text());
  });
  await page.goto('/');
  await expect(page.locator('section[data-id^=shelf-]')).toHaveCount(2);
  expect(await page.locator('section[data-id^=shelf-]').evaluateAll((sections) => sections.map((s) => s.getAttribute('data-id')))).toEqual(['shelf-kids', 'shelf-adults']);
  await expect(page.locator('[data-id=story-list-kids] [data-id=story-card-son-tinh-thuy-tinh]')).toBeVisible();
  await expect(page.locator('[data-id=story-list-adults] [data-id=story-card-su-tich-ho-guom]')).toBeVisible();
  await expect(page.locator('[data-id=story-list-adults] [data-id=story-card-son-tinh-thuy-tinh]')).toHaveCount(0);

  await page.click('[data-id=story-open-su-tich-ho-guom]');
  await expect(page).toHaveURL(/\/truyen\/su-tich-ho-guom$/);
  await expect(page.locator('[data-id=story-shelf]')).toHaveText('Kệ Người lớn');
  await page.click('[data-id=story-open-reader]');
  await expect(page.locator('[data-id=story-subtitle-line]')).toHaveText('Đầu thế kỷ mười lăm, giặc Minh sang chiếm nước ta.');
  await page.keyboard.press('Escape');
  await page.click('[data-id=story-back]');
  await expect(page).toHaveURL(/\/nguoi-lon$/);
  await expect(page.locator('[data-id=shelf-kids]')).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(page.viewportSize()?.width ?? 0);
  await page.screenshot({ path: test.info().outputPath('home-shelves.png'), fullPage: true });
  expect(consoleErrors).toEqual([]);
});

test('each story answers with its own prerendered page, still kept out of search engines', async ({ request }) => {
  const response = await request.get('/truyen/tam-cam');
  expect(response.status()).toBe(200);
  const html = await response.text();
  expect(html).toContain('<title>Tấm Cám · ');
  expect(html).toContain('<h1 lang="vi">Tấm Cám</h1>');
  expect(html).toContain('"@type":"CreativeWork"');
  expect(html).toContain('<meta name="robots" content="noindex, nofollow" />');
  const shelf = await (await request.get('/tre-em')).text();
  expect(shelf).toContain('href="/truyen/son-tinh-thuy-tinh"');
  expect(shelf).not.toContain('href="/truyen/su-tich-ho-guom"');
});

test('a shelf finds stories typed without marks and keeps the search in the address', async ({ page }) => {
  await page.goto('/tre-em');
  await page.fill('[data-id=shelf-search]', 'son tinh');
  await expect(page.locator('[data-id=story-list-kids] > li')).toHaveCount(1);
  await expect(page.locator('[data-id=story-card-son-tinh-thuy-tinh] mark').first()).toHaveText('Sơn');
  await expect(page).toHaveURL(/\?q=son\+tinh$/);
  await page.reload();
  await expect(page.locator('[data-id=shelf-search]')).toHaveValue('son tinh');
  await page.click('[data-id=shelf-clear]');
  await page.click('[data-id=filter-length-ngan]');
  await expect(page).toHaveURL(/do-dai=ngan/);
  expect(await page.locator('[data-id=story-list-kids] > li').count()).toBeGreaterThan(1);
});

test('lights off is kept by Truyện alone and survives a reload without a bright flash', async ({ page, context }) => {
  await page.goto('/');
  await page.click('[data-id=header-lights]');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  expect((await context.cookies()).map((cookie) => cookie.name)).not.toContain('hd_theme');
});
