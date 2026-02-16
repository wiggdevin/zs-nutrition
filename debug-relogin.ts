/**
 * Debug script to test the re-login flow
 */

import { chromium } from 'playwright';

const BASE_URL = 'http://localhost:3456';
const TEST_EMAIL = 'e2e-1770186823524@test.com'; // Use existing test user

async function main() {
  console.log('\n=== DEBUG RE-LOGIN FLOW ===\n');
  console.log(`Testing with: ${TEST_EMAIL}\n`);

  const browser = await chromium.launch({
    headless: false,
    slowMo: 100,
  });

  const context = await browser.newContext({
    viewport: { width: 1400, height: 900 },
  });

  const page = await context.newPage();

  // Enable console logging
  page.on('console', (msg) => {
    if (msg.type() === 'error' || msg.type() === 'warn') {
      console.log(`[${msg.type()}] ${msg.text().slice(0, 200)}`);
    }
  });

  // Monitor network requests
  page.on('response', async (response) => {
    const url = response.url();
    if (url.includes('/api/')) {
      const status = response.status();
      console.log(`[API] ${response.request().method()} ${url.split('?')[0]} -> ${status}`);

      // Log response body for key endpoints
      if (url.includes('/api/dashboard/data') || url.includes('/api/plan/active')) {
        try {
          const body = await response.json();
          console.log(`      planId: ${body.planId || body.plan?.id || 'null'}`);
          console.log(`      hasProfile: ${body.hasProfile}`);
          if (body.todayPlanMeals) {
            console.log(`      todayPlanMeals: ${body.todayPlanMeals.length} meals`);
          }
        } catch {
          // Ignore JSON parse errors
        }
      }
    }
  });

  try {
    // Go to sign-in
    console.log('1. Navigating to sign-in...');
    await page.goto(`${BASE_URL}/sign-in`);
    await page.waitForTimeout(1500);

    // Fill email
    console.log('2. Filling email...');
    await page.fill('input[type="email"]', TEST_EMAIL);
    await page.waitForTimeout(500);

    // Submit
    console.log('3. Clicking Continue...');
    await page.click('button[type="submit"]');
    await page.waitForTimeout(1500);

    // Click Sign In & Continue
    console.log('4. Clicking Sign In & Continue...');
    const signInBtn = page.locator('button:has-text("Sign In & Continue")');
    await signInBtn.waitFor({ state: 'visible', timeout: 5000 });
    await signInBtn.click();
    await page.waitForTimeout(3000);

    // Check current URL
    console.log(`\n5. Current URL: ${page.url()}`);

    // Get cookies
    const cookies = await context.cookies();
    const devUserIdCookie = cookies.find((c) => c.name === 'dev-user-id');
    console.log(`6. dev-user-id cookie: ${devUserIdCookie?.value || 'NOT SET'}`);

    // Navigate to dashboard explicitly
    console.log('\n7. Navigating to dashboard...');
    await page.goto(`${BASE_URL}/dashboard`);
    await page.waitForTimeout(3000);

    // Check for plan content
    const planMealsCount = await page
      .locator('[data-testid="plan-meal"], .plan-meal, [class*="meal"]')
      .count();
    console.log(`8. Plan meals on page: ${planMealsCount}`);

    // Check for empty state
    const emptyState = await page.locator('text=NO MEAL PLANS YET').count();
    console.log(`9. Empty state visible: ${emptyState > 0 ? 'YES' : 'NO'}`);

    console.log('\n=== DEBUG COMPLETE ===');
    console.log('Browser is open. Press Ctrl+C to close.\n');

    // Keep browser open
    await new Promise<void>((resolve) => {
      process.on('SIGINT', () => resolve());
    });
  } catch (error) {
    console.error('\nError:', error);
  } finally {
    await browser.close();
  }
}

main().catch(console.error);
