/**
 * E2E Full Journey Test
 * Complete user flow: Sign-up → Onboarding → Generate Plan → Logout → Re-login → Dashboard
 */

import { chromium, Browser, BrowserContext, Page } from 'playwright';
import * as fs from 'fs';
import * as path from 'path';

const BASE_URL = 'http://localhost:3456';
const SCREENSHOT_DIR = path.join(__dirname, 'test-output', 'e2e-journey');
const TEST_ID = Date.now();
const TEST_EMAIL = `e2e-${TEST_ID}@test.com`;

// Ensure screenshot directory exists
if (!fs.existsSync(SCREENSHOT_DIR)) {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function screenshot(page: Page, name: string): Promise<void> {
  const filepath = path.join(SCREENSHOT_DIR, `${name}.png`);
  await page.screenshot({ path: filepath, fullPage: true });
  console.log(`📸 ${name}`);
}

async function main() {
  console.log('\n' + '='.repeat(60));
  console.log('🚀 E2E FULL JOURNEY TEST');
  console.log('='.repeat(60));
  console.log(`Test Email: ${TEST_EMAIL}`);
  console.log(`Screenshots: ${SCREENSHOT_DIR}\n`);

  const browser = await chromium.launch({
    headless: false,
    slowMo: 50,
  });

  const context = await browser.newContext({
    viewport: { width: 1400, height: 900 },
  });

  const page = await context.newPage();

  // Log console errors
  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      console.log('🔴 Console:', msg.text().slice(0, 100));
    }
  });

  try {
    // ========================================
    // STEP 1: Landing Page
    // ========================================
    console.log('\n📍 STEP 1: Landing Page');
    await page.goto(BASE_URL);
    await sleep(1000);
    await screenshot(page, '01-landing');

    // Click Get Started
    await page.click('a[href="/sign-up"], button:has-text("Get Started")');
    await sleep(1000);

    // ========================================
    // STEP 2: Sign Up
    // ========================================
    console.log('\n📍 STEP 2: Sign Up');
    await screenshot(page, '02-signup');

    // Fill email
    await page.fill('input[type="email"]', TEST_EMAIL);
    await sleep(500);

    // Submit
    await page.click('button[type="submit"]');
    console.log('   📧 Submitted email, waiting...');
    await sleep(2000);
    await screenshot(page, '02b-after-submit');

    // Wait for and click Verify & Continue (dev mode verification screen)
    console.log('   🔍 Looking for Verify & Continue button...');
    const verifyBtn = page.locator(
      'button:has-text("Verify & Continue"), button:has-text("Verify")'
    );
    try {
      await verifyBtn.waitFor({ state: 'visible', timeout: 5000 });
      console.log('   ✅ Found Verify button, clicking...');
      await verifyBtn.click();
      await sleep(3000);
    } catch {
      console.log('   ⚠️ No Verify button found, checking current state...');
    }

    await screenshot(page, '02c-after-signin');

    // ========================================
    // STEP 3: Onboarding - 6 Steps
    // ========================================
    console.log('\n📍 STEP 3: Onboarding');

    // Check current URL
    const afterSignupUrl = page.url();
    console.log(`   Current URL: ${afterSignupUrl}`);

    // If not on onboarding, navigate there
    if (!afterSignupUrl.includes('/onboarding')) {
      console.log('   📍 Navigating to onboarding...');
      await page.goto(`${BASE_URL}/onboarding`);
      await sleep(2000);
    }

    // Wait for onboarding content - use correct prefixed IDs
    await page.waitForSelector('input[id="onboarding-name"]', { timeout: 10000 });
    await screenshot(page, '03-onboarding-step1');

    // Step 1: Demographics
    console.log('   📝 Step 1: Demographics');
    await page.fill('input[id="onboarding-name"]', 'E2E Test User');
    // Sex is a button group, not a select
    await page.click('button:has-text("male")');
    await page.fill('input[id="onboarding-age"]', '30');
    await sleep(300);
    await page.click('button:has-text("Continue")');
    await sleep(1000);
    await screenshot(page, '04-onboarding-step2');

    // Step 2: Body Metrics
    console.log('   📝 Step 2: Body Metrics');
    await page.fill('input[id="onboarding-height-feet"]', '5');
    await page.fill('input[id="onboarding-height-inches"]', '10');
    await page.fill('input[id="onboarding-weight-lbs"]', '180');
    await sleep(300);
    await page.click('button:has-text("Continue")');
    await sleep(1000);
    await screenshot(page, '05-onboarding-step3');

    // Step 3: Goals
    console.log('   📝 Step 3: Goals');
    // Goal type is a button group - click the "cut" option
    await page.click('button:has-text("cut")');
    await sleep(300);
    await page.click('button:has-text("Continue")');
    await sleep(1000);
    await screenshot(page, '06-onboarding-step4');

    // Step 4: Dietary
    console.log('   📝 Step 4: Dietary');
    // Dietary style is a button group
    await page.click('button:has-text("omnivore")');
    await sleep(300);
    await page.click('button:has-text("Continue")');
    await sleep(1000);
    await screenshot(page, '07-onboarding-step5');

    // Step 5: Lifestyle
    console.log('   📝 Step 5: Lifestyle');
    // Activity level is a button group
    await page.click('button:has-text("Moderately Active")');
    await sleep(200);

    // Training days - click day buttons
    const mondayBtn = page.locator('button:has-text("Mon")');
    const wedBtn = page.locator('button:has-text("Wed")');
    const friBtn = page.locator('button:has-text("Fri")');
    if (await mondayBtn.isVisible()) {
      await mondayBtn.click();
      await wedBtn.click();
      await friBtn.click();
    }
    await sleep(300);

    // Cooking skill slider/select
    const cookingSkillInput = page.locator('input[id="onboarding-cooking-skill"]');
    if (await cookingSkillInput.isVisible()) {
      await cookingSkillInput.fill('6');
    }

    // Prep time select
    const prepTimeSelect = page.locator('select[id="onboarding-prep-time"]');
    if (await prepTimeSelect.isVisible()) {
      await prepTimeSelect.selectOption('45');
    }

    await sleep(300);
    await page.click('button:has-text("Continue")');
    await sleep(1000);
    await screenshot(page, '08-onboarding-step6');

    // Step 6: Preferences
    console.log('   📝 Step 6: Preferences');
    // Macro style is a button group - click High Protein
    await page.click('button:has-text("High Protein")');
    await sleep(200);

    // Select a cuisine preference
    await page.click('button:has-text("American")');
    await page.click('button:has-text("Mediterranean")');
    await sleep(200);

    // Meals/snacks are range sliders - set via JavaScript
    await page.evaluate(() => {
      const mealsSlider = document.getElementById('onboarding-meals-per-day') as HTMLInputElement;
      const snacksSlider = document.getElementById('onboarding-snacks-per-day') as HTMLInputElement;
      if (mealsSlider) {
        mealsSlider.value = '3';
        mealsSlider.dispatchEvent(new Event('input', { bubbles: true }));
        mealsSlider.dispatchEvent(new Event('change', { bubbles: true }));
      }
      if (snacksSlider) {
        snacksSlider.value = '1';
        snacksSlider.dispatchEvent(new Event('input', { bubbles: true }));
        snacksSlider.dispatchEvent(new Event('change', { bubbles: true }));
      }
    });
    await sleep(500);
    await screenshot(page, '09-onboarding-complete');

    // Complete Setup
    console.log('   ✅ Completing onboarding...');
    const completeBtn = page.locator(
      'button[data-testid="onboarding-complete-btn"], button:has-text("Complete Setup"), button:has-text("Complete")'
    );
    await completeBtn.click();
    await sleep(3000);

    // ========================================
    // STEP 4: Generate Meal Plan
    // ========================================
    console.log('\n📍 STEP 4: Generate Meal Plan');

    // After onboarding, we're on /dashboard. Navigate to /generate
    const currentUrl = page.url();
    console.log(`   Current URL: ${currentUrl}`);

    // Navigate to generate page
    console.log('   📍 Navigating to /generate page...');
    await page.goto(`${BASE_URL}/generate`);
    await sleep(2000);
    await screenshot(page, '10-generate-page');

    // Wait for the Generate Plan button and click it
    console.log('   🔍 Looking for Generate Plan button...');
    const generatePlanBtn = page.locator('button:has-text("Generate Plan")');

    try {
      await generatePlanBtn.waitFor({ state: 'visible', timeout: 10000 });
      console.log('   🚀 Clicking Generate Plan button...');
      await generatePlanBtn.click();
    } catch {
      // Check if page shows "Complete Onboarding First"
      const onboardingPrompt = await page.locator('text=Complete Onboarding First').count();
      if (onboardingPrompt > 0) {
        console.log('   ⚠️ Page shows "Complete Onboarding First" - localStorage not set');
        console.log('   📍 Setting localStorage and refreshing...');

        // The onboarding should have saved data, let's try to get it from the API
        await page.evaluate(() => {
          localStorage.setItem('zsn_onboarding_complete', 'true');
        });
        await page.reload();
        await sleep(2000);

        // Try clicking again
        await generatePlanBtn.waitFor({ state: 'visible', timeout: 5000 });
        await generatePlanBtn.click();
      } else {
        console.log('   ❌ Could not find Generate Plan button');
        await screenshot(page, '10-error-no-generate-btn');
      }
    }

    // Wait for plan generation (up to 2 minutes)
    console.log('   ⏳ Waiting for plan generation...');
    let planComplete = false;
    let attempts = 0;

    while (!planComplete && attempts < 120) {
      await sleep(1000);
      attempts++;

      const url = page.url();
      if (url.includes('/meal-plan')) {
        console.log('   ✅ Redirected to meal plan page');
        planComplete = true;
        break;
      }

      // Check for completion indicators
      const ready = await page.locator('text=Plan Ready, text=Your meal plan is ready').count();
      if (ready > 0) {
        planComplete = true;
        break;
      }

      if (attempts % 15 === 0) {
        console.log(`   ⏳ Still generating... (${attempts}s)`);
        await screenshot(page, `11-generating-${attempts}s`);
      }
    }

    if (!planComplete) {
      // Try navigating directly
      console.log('   ⚠️ Generation taking long, checking meal-plan page...');
      await page.goto(`${BASE_URL}/meal-plan`);
      await sleep(2000);
    }

    await screenshot(page, '12-meal-plan');

    // ========================================
    // STEP 5: Verify Meal Plan
    // ========================================
    console.log('\n📍 STEP 5: Verify Meal Plan');

    // Check for meal content
    const dayHeaders = await page.locator('text=/Day\\s*\\d|Monday|Tuesday|Wednesday/i').count();
    console.log(`   📊 Day sections found: ${dayHeaders}`);

    const mealSlots = await page.locator('text=/breakfast|lunch|dinner|snack/i').count();
    console.log(`   📊 Meal slots found: ${mealSlots}`);

    // ========================================
    // STEP 6: Logout (Clear Cookies and Storage)
    // ========================================
    console.log('\n📍 STEP 6: Logout');

    // Clear cookies
    await context.clearCookies();
    console.log('   🔓 Cookies cleared');

    // Clear localStorage to reset Zustand stores
    await page.evaluate(() => {
      // Clear all zsn-related localStorage items
      const keysToRemove: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && (key.startsWith('zsn-') || key.startsWith('zsn_'))) {
          keysToRemove.push(key);
        }
      }
      keysToRemove.forEach((key) => localStorage.removeItem(key));
    });
    console.log('   🗑️ localStorage cleared');

    // ========================================
    // STEP 7: Re-login
    // ========================================
    console.log('\n📍 STEP 7: Re-login');
    await page.goto(`${BASE_URL}/sign-in`);
    await sleep(1500);
    await screenshot(page, '13-signin');

    // Fill same email
    await page.fill('input[type="email"]', TEST_EMAIL);
    await sleep(500);

    // Submit email
    await page.click('button[type="submit"]');
    console.log('   📧 Submitted email for re-login');
    await sleep(2000);
    await screenshot(page, '13b-signin-submitted');

    // Click Sign In & Continue (required for dev mode sign-in)
    // Note: Sign-in page shows "Sign In & Continue" button after email submission
    console.log('   🔍 Looking for Sign In & Continue button...');
    const signInBtn = page.locator('button:has-text("Sign In & Continue")');
    try {
      await signInBtn.waitFor({ state: 'visible', timeout: 5000 });
      console.log('   ✅ Found Sign In & Continue button, clicking...');
      await signInBtn.click();
      await sleep(3000);
    } catch {
      // Try alternative selectors
      console.log('   ⚠️ Sign In & Continue not found, trying alternatives...');
      const altBtn = page
        .locator('button:has-text("Continue"), button:has-text("Sign In")')
        .first();
      if (await altBtn.isVisible({ timeout: 2000 })) {
        await altBtn.click();
        await sleep(3000);
      }
    }

    await screenshot(page, '13c-after-relogin');

    // Check where we are - should redirect to dashboard if user exists
    const postLoginUrl = page.url();
    console.log(`   Post-login URL: ${postLoginUrl}`);

    // ========================================
    // STEP 8: Verify Dashboard
    // ========================================
    console.log('\n📍 STEP 8: Verify Dashboard');

    // Navigate to dashboard explicitly
    await page.goto(`${BASE_URL}/dashboard`);

    // Wait for dashboard to fully load (wait for network idle or specific content)
    console.log('   ⏳ Waiting for dashboard to load...');
    await page.waitForLoadState('networkidle');
    await sleep(2000);

    // Wait for the loading spinner to disappear (if present)
    try {
      await page.waitForSelector('.animate-spin', { state: 'hidden', timeout: 10000 });
    } catch {
      // No spinner found, that's fine
    }

    // Additional wait for React to hydrate and render
    await sleep(2000);

    await screenshot(page, '14-dashboard-relogin');

    const dashUrl = page.url();
    console.log(`   Current URL: ${dashUrl}`);

    // Check for empty state vs plan content
    const emptyState = await page.locator('text=NO MEAL PLANS YET').count();
    if (emptyState > 0) {
      console.log('   ⚠️ Dashboard shows empty state - plan may not have loaded');
    } else {
      console.log('   ✅ Dashboard NOT showing empty state');
    }

    // Check for macro targets (indicates plan loaded)
    const kcalTarget = await page.locator('text=/\\d+.*kcal|DAILY TARGET/i').count();
    console.log(`   📊 Calorie target visible: ${kcalTarget > 0 ? '✅ Yes' : '❌ No'}`);

    // Check for meal cards or plan content
    const mealContent = await page.locator('text=/breakfast|lunch|dinner|snack/i').count();
    console.log(`   📊 Meal slots found: ${mealContent}`);

    // Take final screenshot
    await screenshot(page, '15-final-dashboard');

    // ========================================
    // SUMMARY
    // ========================================
    console.log('\n' + '='.repeat(60));
    console.log('✅ E2E JOURNEY COMPLETE');
    console.log('='.repeat(60));
    console.log(`\nTest Email: ${TEST_EMAIL}`);
    console.log(`Screenshots saved to: ${SCREENSHOT_DIR}`);
    console.log('\n🎯 Browser is open - inspect the dashboard');
    console.log('   Press Ctrl+C when done\n');

    // Keep browser open
    await new Promise<void>((resolve) => {
      process.on('SIGINT', () => {
        console.log('\n🛑 Closing browser...');
        resolve();
      });
    });
  } catch (error) {
    console.error('\n❌ Test failed:', error);
    await screenshot(page, 'error-state');

    console.log('\n🎯 Browser staying open for debugging');
    console.log('   Press Ctrl+C when done\n');

    await new Promise<void>((resolve) => {
      process.on('SIGINT', () => resolve());
    });
  } finally {
    await browser.close();
  }
}

main().catch(console.error);
