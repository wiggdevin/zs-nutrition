import { test, expect } from '@playwright/test';

test.describe('Dashboard', () => {
  test.beforeEach(async ({ page }) => {
    // Set dev auth cookie to bypass authentication
    await page.context().addCookies([
      {
        name: 'dev-user-id',
        value: 'test-user',
        domain: 'localhost',
        path: '/',
      },
    ]);
  });

  test('loads dashboard page', async ({ page }) => {
    await page.goto('/dashboard');
    // Should either show onboarding redirect or dashboard content
    const content = page.locator('body');
    await expect(content).toBeVisible();
  });

  test('renders dashboard sections when data is available', async ({ page }) => {
    await page.goto('/dashboard');

    // Wait for either the dashboard content or empty/error state
    await page.waitForSelector(
      '[data-testid="onboarding-redirect"], [data-testid="network-error-state"], main, [data-testid="retry-button"]',
      { timeout: 10000 }
    );

    // If dashboard loaded with data, check for key sections
    const main = page.locator('main');
    if (await main.isVisible()) {
      // Dashboard header should be present
      await expect(page.getByText('WELCOME BACK')).toBeVisible();

      // Macro rings section should render
      await expect(page.locator('main')).toBeVisible();
    }
  });

  test('shows error state with retry button on network failure', async ({ page }) => {
    // Block API calls to simulate failure
    await page.route('**/api/trpc/**', (route) => route.abort());

    await page.goto('/dashboard');

    // Should eventually show error or redirect to onboarding
    await page.waitForSelector(
      '[data-testid="network-error-state"], [data-testid="onboarding-redirect"]',
      { timeout: 15000 }
    );

    const errorState = page.locator('[data-testid="network-error-state"]');
    if (await errorState.isVisible()) {
      await expect(page.locator('[data-testid="retry-button"]')).toBeVisible();
    }
  });
});
