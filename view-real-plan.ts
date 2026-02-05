/**
 * Open browser to view the real AI-generated meal plan
 */

import { chromium } from 'playwright';

const BASE_URL = 'http://localhost:3456';
const TEST_EMAIL = 'e2e-1770187436247@test.com';

async function main() {
  console.log('\n🌐 Opening browser to view the REAL meal plan...\n');
  console.log(`User: ${TEST_EMAIL}`);

  const browser = await chromium.launch({
    headless: false,
    slowMo: 100,
  });

  const context = await browser.newContext({
    viewport: { width: 1400, height: 900 },
  });

  const page = await context.newPage();

  // Log in
  console.log('1. Logging in...');
  await page.goto(`${BASE_URL}/sign-in`);
  await page.waitForTimeout(1000);

  await page.fill('input[type="email"]', TEST_EMAIL);
  await page.click('button[type="submit"]');
  await page.waitForTimeout(1500);

  // Click Sign In & Continue
  const signInBtn = page.locator('button:has-text("Sign In & Continue")');
  await signInBtn.waitFor({ state: 'visible', timeout: 5000 });
  await signInBtn.click();
  await page.waitForTimeout(2000);

  console.log('2. Navigating to meal plan page...');
  await page.goto(`${BASE_URL}/meal-plan`);
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(2000);

  console.log('\n✅ Browser is open showing your meal plan with REAL FatSecret recipe data!\n');
  console.log('📋 Please verify the following fixes:\n');
  console.log('   1. MACROS: Values should show one decimal place (e.g., "54.7g" not "54.71g")');
  console.log('   2. RECIPE INSTRUCTIONS: Click on any meal card to see real cooking steps');
  console.log('   3. MEAL SWAP: Click "Swap" on any meal to see alternative options\n');
  console.log('Press Ctrl+C when done inspecting.\n');

  // Keep browser open
  await new Promise<void>((resolve) => {
    process.on('SIGINT', () => resolve());
  });

  await browser.close();
}

main().catch(console.error);
