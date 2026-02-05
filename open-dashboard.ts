/**
 * Open dashboard with dev auth login
 */

import { chromium } from 'playwright';

const DEV_SERVER_URL = 'http://localhost:3456';
const TEST_EMAIL = 'fatsecret-test@zsnutrition.test';

async function main() {
  console.log('🎭 Opening dashboard with dev auth...\n');

  const browser = await chromium.launch({
    headless: false,
    slowMo: 100,
  });

  const context = await browser.newContext({
    viewport: { width: 1400, height: 900 },
  });

  const page = await context.newPage();

  // Step 1: Sign in via dev-auth API
  console.log('📋 Signing in as test user...');
  const response = await page.request.post(DEV_SERVER_URL + '/api/dev-auth/signin', {
    data: { email: TEST_EMAIL, redirectUrl: '/dashboard' },
  });

  const result = await response.json();
  console.log('   Response:', JSON.stringify(result, null, 2));

  if (!result.success) {
    console.error('❌ Sign in failed:', result.error);
    await browser.close();
    process.exit(1);
  }

  console.log('   ✅ Signed in as:', result.email);

  // Step 2: Navigate to dashboard
  console.log('\n🌐 Opening dashboard...');
  await page.goto(DEV_SERVER_URL + '/dashboard');
  await page.waitForTimeout(2000);
  console.log('   ✅ Dashboard loaded');

  // Step 3: Open meal plan in new tab
  console.log('\n🌐 Opening meal plan...');
  const mealPlanPage = await context.newPage();
  await mealPlanPage.goto(DEV_SERVER_URL + '/meal-plan');
  await mealPlanPage.waitForTimeout(2000);
  console.log('   ✅ Meal plan loaded');

  console.log('\n' + '='.repeat(50));
  console.log('✅ Dashboard is open with the generated meal plan');
  console.log('   Press Ctrl+C to close when done');
  console.log('='.repeat(50));

  // Keep browser open
  await new Promise((resolve) => {
    process.on('SIGINT', () => {
      console.log('\n🛑 Closing...');
      resolve(undefined);
    });
  });

  await browser.close();
}

main().catch(console.error);
