import { type Page, devices, expect, test } from '@playwright/test';
import { DEPLOYED_URL } from './e2e-env';
import { withProductionCsp } from './site-csp';

const STORY = '/truyen/son-tinh-thuy-tinh';

function collectConsoleErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  page.on('pageerror', (error) => errors.push(error.message));
  return errors;
}

/** Signs in from the header (the fake IdP consents at once) and waits to be back, signed in, on the same page. */
async function signInFromHeader(page: Page): Promise<void> {
  const back = new URL(page.url()).pathname;
  await page.click('[data-id=header-sign-in]');
  await expect(page).toHaveURL(new RegExp(`${back.replace(/\//g, '\\/')}$`));
  await expect(page.locator('[data-id=topbar-account]')).toBeVisible();
}

test('a guest reads as before, with "Đăng nhập" in the header and a way to save the story', async ({ page }) => {
  const consoleErrors = collectConsoleErrors(page);
  await withProductionCsp(page);
  await page.goto(STORY);
  const signIn = page.locator('[data-id=header-sign-in]');
  await expect(signIn).toHaveText('Đăng nhập');
  await expect(signIn).toHaveAttribute('href', '/auth/login?return=%2Ftruyen%2Fson-tinh-thuy-tinh&lang=vi');
  await expect(page.locator('[data-id=story-save-sign-in]')).toHaveText('Đăng nhập để lưu truyện');
  // Reading needs no account: the reader opens and turns as it always did, the place kept in this browser.
  await page.click('[data-id=story-open-reader]');
  await expect(page.locator('[data-id=story-subtitle-line]')).toHaveText('Xin chào các bạn nhỏ! Mình là Mèo Miu đây.');
  await page.click('[data-id=story-next]');
  await expect(page.locator('[data-id=story-scene-number]')).toContainText('Cảnh 2/8');
  await page.keyboard.press('Escape');
  await expect(page.locator('[data-id=story-open-reader]')).toHaveText('Đọc tiếp từ cảnh 2');
  // The reader's own pages ask a guest to sign in, and are kept out of search engines.
  await page.goto('/tu-truyen');
  await expect(page.locator('[data-id=personal-sign-in-button]')).toBeVisible();
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', 'noindex, nofollow');
  expect(consoleErrors).toEqual([]);
});

test.describe('signed in', () => {
  test.skip(DEPLOYED_URL !== undefined, 'signs in through the test-only IdP');

  test('saves a story and continues it on another device, with the history to go back to', async ({ page, browser }) => {
    const consoleErrors = collectConsoleErrors(page);
    await withProductionCsp(page);
    await page.goto(STORY);
    await signInFromHeader(page);

    await page.click('[data-id=story-save]');
    await expect(page.locator('[data-id=story-save]')).toHaveText('Đã lưu vào tủ');

    // Read up to scene 3 on this device; the progress goes up a moment later.
    const sent = page.waitForResponse(
      (res) => res.url().endsWith('/api/reading') && res.request().method() === 'POST' && res.ok() && (res.request().postData() ?? '').includes('"index":2'),
    );
    await page.goto(`${STORY}?canh=3`);
    await expect(page.locator('[data-id=story-scene-number]')).toContainText('Cảnh 3/8');
    await sent;

    // Another device: nothing in its browser, the same account.
    const other = await browser.newContext({ ...devices['Pixel 7'], baseURL: new URL(page.url()).origin });
    const phone = await other.newPage();
    await withProductionCsp(phone);
    await phone.goto(STORY);
    await signInFromHeader(phone);
    await expect(phone.locator('[data-id=story-open-reader]')).toHaveText('Đọc tiếp từ cảnh 3');
    await expect(phone.locator('[data-id=story-save]')).toHaveText('Đã lưu vào tủ');

    await phone.goto('/tu-truyen');
    await expect(phone.locator('[data-id=my-shelf-list] [data-id=story-card-son-tinh-thuy-tinh]')).toBeVisible();
    await phone.goto('/lich-su');
    await expect(phone.locator('[data-id=history-item-son-tinh-thuy-tinh]')).toContainText('Dừng ở cảnh 3/8');
    await phone.click('[data-id=history-continue-son-tinh-thuy-tinh]');
    await expect(phone).toHaveURL(/\/truyen\/son-tinh-thuy-tinh\?canh=3$/);
    await expect(phone.locator('[data-id=story-scene-number]')).toContainText('Cảnh 3/8');
    await other.close();

    // Signing out leaves a guest who still reads.
    await page.goto(STORY);
    await page.click('[data-id=topbar-account]');
    await page.click('[data-id=account-menu-sign-out]');
    await expect(page.locator('[data-id=header-sign-in]')).toBeVisible();
    expect(consoleErrors).toEqual([]);
  });
});
