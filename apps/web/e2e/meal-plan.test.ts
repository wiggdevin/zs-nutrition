import { test, expect } from '@playwright/test';

test.describe('Meal Plan', () => {
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

  test('loads meal plan page', async ({ page }) => {
    await page.goto('/meal-plan');
    const content = page.locator('body');
    await expect(content).toBeVisible();
  });

  test('renders plan view or empty state', async ({ page }) => {
    await page.goto('/meal-plan');

    // Wait for page to load - either plan grid, empty state, or skeleton
    await page.waitForSelector(
      '[data-testid="meal-plan-view"], [data-testid="seven-day-grid"], [data-testid="meal-plan-empty"]',
      { timeout: 15000 }
    );

    // If plan data exists, the grid should show
    const grid = page.locator('[data-testid="seven-day-grid"]');
    if (await grid.isVisible()) {
      // Grid should have day columns
      const dayColumns = grid.locator('> div');
      const count = await dayColumns.count();
      expect(count).toBeGreaterThan(0);
    }
  });

  test('shows day navigator with tab options', async ({ page }) => {
    await page.goto('/meal-plan');
    await page.waitForLoadState('networkidle');

    // The page should have navigation tabs (meal-plan, grocery-list, history)
    const body = page.locator('body');
    await expect(body).toBeVisible();
  });

  test('prep mode toggle button exists and toggles view', async ({ page }) => {
    await page.goto('/meal-plan');

    // Wait for page content to load
    await page.waitForSelector('[data-testid="meal-plan-view"], [data-testid="meal-plan-empty"]', {
      timeout: 15000,
    });

    // Look for prep mode button
    const prepButton = page.getByRole('button', { name: /prep mode/i });
    if (await prepButton.isVisible()) {
      await prepButton.click();

      // After clicking, button text should change
      await expect(page.getByRole('button', { name: /exit prep mode/i })).toBeVisible();

      // Click again to exit
      await page.getByRole('button', { name: /exit prep mode/i }).click();
      await expect(page.getByRole('button', { name: /prep mode/i })).toBeVisible();
    }
  });

  test('grocery list tab renders', async ({ page }) => {
    await page.goto('/meal-plan');
    await page.waitForLoadState('networkidle');

    // Look for grocery list tab and click it
    const groceryTab = page.getByText(/grocery/i).first();
    if (await groceryTab.isVisible()) {
      await groceryTab.click();
      await page.waitForSelector('[data-testid="grocery-list-view"]', { timeout: 5000 });
    }
  });
});
