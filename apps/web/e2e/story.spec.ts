import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { type Locator, type Page, expect, test } from '@playwright/test';
import { estimateReadingSeconds, validateStory } from '@truyen/story';
import { withProductionCsp } from './site-csp';

const STORY_FILE = new URL('../../../stories/son-tinh-thuy-tinh/story.json', import.meta.url);
const checked = validateStory(JSON.parse(readFileSync(STORY_FILE, 'utf8')), 'son-tinh-thuy-tinh');
if (!checked.ok) throw new Error(checked.errors.join('\n'));
/** The first scene's length on the browser timer (no recorded voice yet). */
const FIRST_SCENE_MS = estimateReadingSeconds(checked.story.scenes[0]?.narration ?? '') * 1000;
const pilot = checked.story;

function collectConsoleErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  page.on('pageerror', (error) => errors.push(error.message));
  return errors;
}

/** The reader with the book at rest: no page held or turning, on the spread the story is on. */
async function bookAtRest(page: Page): Promise<void> {
  await expect(page.locator('[data-id=story-player]')).toHaveAttribute('data-settled', 'true');
}

/** The open page (or two-page spread) the turning book shows: its pages at rest carry the library's `--simple`. */
async function openPagesBox(page: Page): Promise<{ x: number; y: number; width: number; height: number }> {
  const boxes = (await page.locator('.flip-page.--simple').evaluateAll((pages) => pages.map((p) => p.getBoundingClientRect().toJSON() as DOMRect)))
    .filter((box) => box.width > 0);
  if (boxes.length === 0) throw new Error('no page on show');
  const x = Math.min(...boxes.map((box) => box.x));
  const right = Math.max(...boxes.map((box) => box.x + box.width));
  return { x, y: boxes[0]?.y ?? 0, width: right - x, height: boxes[0]?.height ?? 0 };
}

/** Takes the page by a bottom corner and drags it across the book: right to left turns on, left to right back. */
async function dragPage(page: Page, to: 'next' | 'prev', release = true): Promise<void> {
  const box = await openPagesBox(page);
  const y = box.y + box.height - 12;
  const [fromX, toX] = to === 'next' ? [box.x + box.width - 12, box.x - 40] : [box.x + 12, box.x + box.width + 40];
  await page.mouse.move(fromX, y);
  await page.mouse.down();
  await page.mouse.move(toX, y - box.height * 0.2, { steps: 16 });
  if (release) await page.mouse.up();
}

const sceneNumber = (page: Page): Locator => page.locator('[data-id=story-scene-number]');

test('open the pilot story and step through it scene by scene', async ({ page }) => {
  const consoleErrors = collectConsoleErrors(page);
  await withProductionCsp(page);
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
  // Real time again: the pages turn on the browser's own frames from here.
  await page.clock.resume();
  await bookAtRest(page);
  await expect(page.locator('[data-id=story-player]')).toHaveAttribute('data-book', 'turning');

  await page.click('[data-id=story-play]');
  await page.click('[data-id=story-next]');
  await expect(page.locator('[data-id=story-scene-number]')).toContainText('Cảnh 3/8');
  await page.click('[data-id=story-prev]');
  await expect(page.locator('[data-id=story-scene-number]')).toContainText('Cảnh 2/8');
  await page.keyboard.press('ArrowRight');
  await expect(page.locator('[data-id=story-scene-number]')).toContainText('Cảnh 3/8');
  // The page taken by its corner and dragged over turns on, once.
  await bookAtRest(page);
  await dragPage(page, 'next');
  await expect(sceneNumber(page)).toContainText('Cảnh 4/8');
  await bookAtRest(page);
  await expect(sceneNumber(page)).toContainText('Cảnh 4/8');
  await expect(page.locator('[data-id=story-subtitle-line]')).toHaveText(pilot.scenes[3]?.subtitles[0] ?? '');
  // No voice or music yet, so nothing to mute.
  await expect(page.locator('[data-id=story-mute]')).toHaveCount(0);

  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(page.viewportSize()?.width ?? 0);
  await page.screenshot({ path: test.info().outputPath('story-scene-4.png'), fullPage: true });
  expect(consoleErrors).toEqual([]);
});

test('the home page shows the children\'s shelf first, then the adults\' shelf', async ({ page }) => {
  const consoleErrors = collectConsoleErrors(page);
  await withProductionCsp(page);
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
  // The adults' shelf also turns on a tap near the page's edge.
  await bookAtRest(page);
  const open = await openPagesBox(page);
  await page.mouse.click(open.x + open.width - 10, open.y + open.height / 2);
  await expect(sceneNumber(page)).toContainText('Cảnh 2/11');
  await bookAtRest(page);
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

test.describe('the open book on a wide screen', () => {
  test.use({ viewport: { width: 1440, height: 900 }, isMobile: false, hasTouch: false, deviceScaleFactor: 1 });

  test('turns its two-page spreads with the keys, the scene list and the hand, to the last page and back', async ({ page }) => {
    const consoleErrors = collectConsoleErrors(page);
    await withProductionCsp(page);
    await page.goto('/truyen/son-tinh-thuy-tinh?canh=2');
    await expect(sceneNumber(page)).toContainText('Cảnh 2/8');
    await bookAtRest(page);
    // Picture on the left page, the subtitles on the right one.
    const picture = await page.locator('[data-id=story-picture]').boundingBox();
    const line = await page.locator('[data-id=story-subtitle-line]').boundingBox();
    expect(picture && line && picture.x + picture.width).toBeLessThan(line?.x ?? 0);

    await page.keyboard.press('PageDown');
    await expect(sceneNumber(page)).toContainText('Cảnh 3/8');
    await bookAtRest(page);
    await dragPage(page, 'prev');
    await expect(sceneNumber(page)).toContainText('Cảnh 2/8');
    await bookAtRest(page);

    // Lights off while a page turns: the curl keeps the lamplit paper.
    await page.click('[data-id=reader-lights]');
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
    await page.keyboard.press('ArrowRight');
    await expect(page.locator('[data-id=story-player]')).toHaveAttribute('data-settled', 'false');
    await page.screenshot({ path: test.info().outputPath('lights-off-mid-turn.png') });
    await bookAtRest(page);

    await page.click('[data-id=story-scenes]');
    await page.click('[data-id=scene-index-8]');
    await expect(sceneNumber(page)).toContainText('Cảnh 8/8');
    await bookAtRest(page);
    await page.click('[data-id=story-next]');
    await expect(page.locator('[data-id=story-ended]')).toBeVisible();
    await expect(page.locator('[data-id=story-end-shelf]')).toHaveAttribute('href', '/tre-em');
    await bookAtRest(page);
    await page.keyboard.press('ArrowLeft');
    await expect(sceneNumber(page)).toContainText('Cảnh 8/8');
    await bookAtRest(page);
    // Only the pages next to the one on show carry content.
    expect(await page.locator('.flip-page:has(.flip-face)').count()).toBeLessThanOrEqual(6);
    expect(consoleErrors).toEqual([]);
  });

  test('pauses a scene\'s motion while its page is held, and plays it again when the page is let go', async ({ page }) => {
    const consoleErrors = collectConsoleErrors(page);
    await withProductionCsp(page);
    // Test-only motion: a tiny clip from e2e/fixtures stands in for every scene's video.
    const withMotion = { ...pilot, scenes: pilot.scenes.map((scene) => ({ ...scene, video: { ...scene.video, file: `media/scenes/${scene.id}.mp4` } })) };
    await page.route('**/stories/son-tinh-thuy-tinh/story.json', (route) => route.fulfill({ json: withMotion }));
    await page.route('**/stories/son-tinh-thuy-tinh/media/scenes/*.mp4', (route) =>
      route.fulfill({ path: fileURLToPath(new URL('fixtures/scene-motion.webm', import.meta.url)), contentType: 'video/webm' }),
    );
    await page.goto('/truyen/son-tinh-thuy-tinh?canh=2');
    await bookAtRest(page);
    const video = page.locator('[data-id=story-picture] video');
    await expect(video).toHaveAttribute('src', new RegExp(`${pilot.scenes[1]?.id ?? ''}\\.mp4$`));
    const isPlaying = (): Promise<boolean> => video.evaluate((v: HTMLVideoElement) => !v.paused && v.readyState >= 2);
    await page.click('[data-id=story-play]');
    await expect.poll(isPlaying).toBe(true);

    await dragPage(page, 'next', false);
    await expect(page.locator('[data-id=story-player]')).toHaveAttribute('data-settled', 'false');
    await expect.poll(isPlaying).toBe(false);
    // Let go before the spine: the page falls back and the motion goes on.
    const open = await openPagesBox(page);
    await page.mouse.move(open.x + open.width - 12, open.y + open.height - 12, { steps: 8 });
    await page.mouse.up();
    await bookAtRest(page);
    await expect(sceneNumber(page)).toContainText('Cảnh 2/8');
    await expect.poll(isPlaying).toBe(true);

    await page.keyboard.press('ArrowRight');
    await expect(sceneNumber(page)).toContainText('Cảnh 3/8');
    await bookAtRest(page);
    await expect(video).toHaveAttribute('src', new RegExp(`${pilot.scenes[2]?.id ?? ''}\\.mp4$`));
    await expect.poll(isPlaying).toBe(true);
    expect(consoleErrors).toEqual([]);
  });
});

test('with reduced motion the page does not curl: the old page fades and a swipe still turns it', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/truyen/son-tinh-thuy-tinh');
  await page.click('[data-id=story-open-reader]');
  await expect(page.locator('[data-id=story-player]')).toHaveAttribute('data-book', 'still');
  await expect(page.locator('.stf__item')).toHaveCount(0);
  await page.click('[data-id=story-next]');
  await expect(sceneNumber(page)).toContainText('Cảnh 2/8');
  await expect(page.locator('.leaf')).toHaveCount(0);
  const book = await page.locator('.book').boundingBox();
  if (!book) throw new Error('no book');
  const y = book.y + book.height / 2;
  await page.mouse.move(book.x + book.width * 0.8, y);
  await page.mouse.down();
  await page.mouse.move(book.x + book.width * 0.2, y, { steps: 4 });
  await page.mouse.up();
  await expect(sceneNumber(page)).toContainText('Cảnh 3/8');
});
