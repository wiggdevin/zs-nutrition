import { test, expect } from '@playwright/test';

const STAGING_URL = process.env.STAGING_URL || 'http://localhost:3000';

test.describe('Staging Smoke Tests', () => {
  test('landing page returns 200', async ({ request }) => {
    const response = await request.get(STAGING_URL);
    expect(response.status()).toBe(200);
  });

  test('/api/health returns ok status', async ({ request }) => {
    const response = await request.get(`${STAGING_URL}/api/health`);
    expect(response.status()).toBeLessThan(400);

    const body = await response.json();
    expect(body.status).toMatch(/^(ok|degraded)$/);
    expect(body).toHaveProperty('db');
    expect(body).toHaveProperty('redis');
    expect(body).toHaveProperty('timestamp');
    expect(body).toHaveProperty('version');
  });

  test('/sign-in page renders', async ({ page }) => {
    await page.goto(`${STAGING_URL}/sign-in`);
    await page.waitForLoadState('domcontentloaded');

    // Clerk auth page should be present
    const title = await page.title();
    expect(title).toBeTruthy();

    // Page should have meaningful content (not a blank error page)
    const bodyText = await page.textContent('body');
    expect(bodyText).toBeTruthy();
    expect(bodyText!.length).toBeGreaterThan(0);
  });

  test('page has proper meta tags', async ({ page }) => {
    await page.goto(STAGING_URL);
    await page.waitForLoadState('domcontentloaded');

    // Verify essential meta tags
    const viewport = await page.getAttribute('meta[name="viewport"]', 'content');
    expect(viewport).toBeTruthy();

    // Check charset
    const charset = await page.$('meta[charset]');
    const charsetHttp = await page.$('meta[http-equiv="Content-Type"]');
    expect(charset || charsetHttp).toBeTruthy();

    // Page should have a title
    const title = await page.title();
    expect(title).toBeTruthy();
    expect(title.length).toBeGreaterThan(0);

    // Check for description meta tag
    const description = await page.getAttribute('meta[name="description"]', 'content');
    if (description) {
      expect(description.length).toBeGreaterThan(0);
    }
  });
});
