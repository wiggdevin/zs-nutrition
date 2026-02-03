/**
 * Feature #274: Direct URL access to /dashboard redirects if no auth
 *
 * Test Steps:
 * 1. Clear all cookies/sessions
 * 2. Type /dashboard in browser URL bar
 * 3. Verify redirect to sign-in page
 * 4. Sign in
 * 5. Verify redirect back to dashboard
 */

import { chromium, Browser, Page, BrowserContext } from 'playwright';

const BASE_URL = 'http://localhost:3456';
const TEST_EMAIL = 'feature-274-test@example.com';

async function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

describe('Feature #274: Dashboard Auth Redirect', () => {
  let browser: Browser;
  let context: BrowserContext;
  let page: Page;

  beforeAll(async () => {
    browser = await chromium.launch({ headless: false });
  });

  afterAll(async () => {
    await browser.close();
  });

  beforeEach(async () => {
    // Create a new browser context with clear cookies
    context = await browser.newContext();
    page = await context.newPage();
  });

  afterEach(async () => {
    await context.close();
  });

  test('Step 1-2: Clear cookies and navigate directly to /dashboard', async () => {
    // Step 1 & 2: Navigate directly to /dashboard (simulating typing in URL bar)
    await page.goto(`${BASE_URL}/dashboard`);

    // Step 3: Verify redirect to sign-in page with redirect_url parameter
    expect(page.url()).toContain('/sign-in');
    expect(page.url()).toContain('redirect_url=%2Fdashboard');

    console.log('✅ Step 3: Verified redirect to sign-in with redirect_url parameter');
    console.log('   URL:', page.url());

    // Take screenshot
    await page.screenshot({ path: 'test-results/feature-274-redirect.png' });
  });

  test('Step 4-5: Sign in and verify redirect back to dashboard', async () => {
    // Start at the redirect URL
    await page.goto(`${BASE_URL}/dashboard`);

    // Wait for redirect to sign-in
    await page.waitForURL(/\/sign-in/);

    // Fill in email
    await page.fill('input[type="email"]', TEST_EMAIL);
    await page.press('input[type="email"]', 'Enter');

    // Wait for "Check your email" screen
    await page.waitForSelector('text=Check your email');
    await sleep(500);

    // Click "Sign In & Continue" button (simulates clicking email link)
    await page.click('button:has-text("Sign In & Continue")');

    // Step 5: Verify redirect back to dashboard
    await page.waitForURL(`${BASE_URL}/dashboard`);
    expect(page.url()).toBe(`${BASE_URL}/dashboard`);

    console.log('✅ Step 5: Verified redirect back to dashboard after sign-in');
    console.log('   URL:', page.url());

    // Take screenshot
    await page.screenshot({ path: 'test-results/feature-274-after-signin.png' });
  });

  test('Verify protected route behavior with dev auth cookie', async () => {
    // First, sign in to get the cookie
    await page.goto(`${BASE_URL}/sign-in`);
    await page.fill('input[type="email"]', TEST_EMAIL);
    await page.press('input[type="email"]', 'Enter');
    await page.waitForSelector('text=Check your email');
    await page.click('button:has-text("Sign In & Continue")');
    await page.waitForURL(`${BASE_URL}/dashboard`);

    // Now navigate to dashboard again (should not redirect)
    await page.goto(`${BASE_URL}/dashboard`);
    expect(page.url()).toBe(`${BASE_URL}/dashboard`);

    console.log('✅ Verified: Authenticated users can access dashboard directly');
  });

  test('Verify middleware prevents API access without auth', async () => {
    // Try to access a protected API route without auth
    const response = await page.request.get(`${BASE_URL}/api/trpc/user.getProfile`, {
      failOnStatusCode: false
    });

    // Should get 401 or be redirected
    expect([401, 403, 308]).toContain(response.status());

    console.log('✅ Verified: API routes protected without auth');
    console.log('   Status:', response.status());
  });
});

// Run tests
console.log('Starting Feature #274 tests...');
console.log('Make sure the dev server is running on port 3456');
