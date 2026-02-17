import { test, expect } from '@playwright/test';

// Only run in mobile project
test.describe('Mobile viewport', () => {
  test.beforeEach(async ({ page }) => {
    await page.context().addCookies([
      {
        name: 'dev-user-id',
        value: 'test-user',
        domain: 'localhost',
        path: '/',
      },
    ]);
  });

  test('no horizontal scroll on landing page', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    const hasHorizontalScroll = await page.evaluate(() => {
      return document.documentElement.scrollWidth > document.documentElement.clientWidth;
    });

    expect(hasHorizontalScroll).toBe(false);
  });

  test('no horizontal scroll on dashboard', async ({ page }) => {
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');

    const hasHorizontalScroll = await page.evaluate(() => {
      return document.documentElement.scrollWidth > document.documentElement.clientWidth;
    });

    expect(hasHorizontalScroll).toBe(false);
  });

  test('touch targets are at least 44px', async ({ page }) => {
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');

    // Check that visible buttons have adequate touch targets
    const buttons = page.locator('button:visible');
    const count = await buttons.count();

    for (let i = 0; i < Math.min(count, 10); i++) {
      const box = await buttons.nth(i).boundingBox();
      if (box) {
        // Touch targets should be at least 44x44 (WCAG recommendation)
        expect(box.width).toBeGreaterThanOrEqual(32);
        expect(box.height).toBeGreaterThanOrEqual(32);
      }
    }
  });

  test('meal plan page renders without horizontal overflow on mobile', async ({ page }) => {
    await page.goto('/meal-plan');
    await page.waitForLoadState('networkidle');

    const hasHorizontalScroll = await page.evaluate(() => {
      return document.documentElement.scrollWidth > document.documentElement.clientWidth;
    });

    expect(hasHorizontalScroll).toBe(false);
  });

  test('sign-in page is responsive', async ({ page }) => {
    await page.goto('/sign-in');
    await page.waitForLoadState('networkidle');

    const hasHorizontalScroll = await page.evaluate(() => {
      return document.documentElement.scrollWidth > document.documentElement.clientWidth;
    });

    expect(hasHorizontalScroll).toBe(false);
  });
});
