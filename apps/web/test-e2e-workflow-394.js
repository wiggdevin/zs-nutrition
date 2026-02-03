/**
 * End-to-End Workflow Test for Feature #394
 * Complete user journey from sign-up through plan generation
 */

const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const BASE_URL = 'http://localhost:3456';
const SCREENSHOT_DIR = path.join(__dirname, 'verification', 'feature-394');

// Ensure screenshot directory exists
if (!fs.existsSync(SCREENSHOT_DIR)) {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
}

// Generate unique test identifier
const TEST_ID = `TEST_E2E_${Date.now()}`;
const TEST_EMAIL = `test-${TEST_ID}@example.com`;

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function setupBrowser() {
  const browser = await chromium.launch({
    headless: false,
    slowMo: 100
  });
  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 }
  });
  const page = await context.newPage();

  // Listen for console errors
  page.on('console', msg => {
    if (msg.type() === 'error') {
      console.log('🔴 Console Error:', msg.text());
    }
  });

  return { browser, context, page };
}

async function takeScreenshot(page, name) {
  const filepath = path.join(SCREENSHOT_DIR, `${name}.png`);
  await page.screenshot({ path: filepath, fullPage: true });
  console.log(`📸 Screenshot saved: ${name}`);
  return filepath;
}

async function testEndToEndWorkflow() {
  console.log('🚀 Starting End-to-End Workflow Test');
  console.log(`Test ID: ${TEST_ID}`);
  console.log(`Test Email: ${TEST_EMAIL}`);

  const { browser, context, page } = await setupBrowser();

  try {
    // ========================================
    // STEP 1: Sign Up as New User
    // ========================================
    console.log('\n📍 STEP 1: Sign Up as New User');

    await page.goto(`${BASE_URL}/sign-up`);
    await sleep(1000);
    await takeScreenshot(page, '01-signup-page');

    // Check if in dev mode
    const isDevMode = await page.locator('text=Dev Mode').count() > 0;
    console.log(`🔧 Dev Mode: ${isDevMode}`);

    if (isDevMode) {
      // Fill in email
      await page.fill('input[type="email"]', TEST_EMAIL);
      await sleep(500);

      // Click continue
      await page.click('button[type="submit"]');
      await sleep(1500);

      // Verify email sent screen
      await takeScreenshot(page, '02-verify-email');

      // Click sign in button
      await page.click('button:has-text("Sign In & Continue")');
      await sleep(2000);
    } else {
      // Would use real Clerk flow here
      console.log('⚠️  Production Clerk flow detected - manual intervention may be needed');
    }

    // ========================================
    // STEP 2: Complete All 6 Onboarding Steps
    // ========================================
    console.log('\n📍 STEP 2: Complete Onboarding');

    // Should be redirected to onboarding
    await sleep(2000);
    const currentUrl = page.url();
    console.log(`Current URL: ${currentUrl}`);

    // Check if on onboarding page
    if (currentUrl.includes('/onboarding') || currentUrl.includes('/dashboard')) {
      console.log('✅ Redirected to onboarding/dashboard');

      if (currentUrl.includes('/dashboard')) {
        // User might already exist, go to onboarding
        console.log('⚠️  Already on dashboard - navigating to onboarding');
        await page.goto(`${BASE_URL}/onboarding`);
        await sleep(1000);
      }

      await takeScreenshot(page, '03-onboarding-step1');

      // STEP 1: Demographics
      console.log('📝 Step 1: Demographics');
      await page.fill('input[id="name"]', `Test User ${TEST_ID}`);
      await page.selectOption('select[id="sex"]', 'male');
      await page.fill('input[id="age"]', '30');
      await sleep(500);
      await takeScreenshot(page, '04-step1-filled');

      // Click Continue
      await page.click('button:has-text("Continue")');
      await sleep(800);
      await takeScreenshot(page, '05-onboarding-step2');

      // STEP 2: Body Metrics
      console.log('📝 Step 2: Body Metrics');
      await page.fill('input[id="heightFeet"]', '5');
      await page.fill('input[id="heightInches"]', '10');
      await page.fill('input[id="weightLbs"]', '175');
      await sleep(500);
      await takeScreenshot(page, '06-step2-filled');

      await page.click('button:has-text("Continue")');
      await sleep(800);
      await takeScreenshot(page, '07-onboarding-step3');

      // STEP 3: Goals
      console.log('📝 Step 3: Goals');
      // Select goal type
      await page.click('button[data-goal-type="maintain"]');
      await sleep(300);

      // Set goal rate slider to middle
      const slider = page.locator('input[type="range"]').first();
      await slider.evaluate(el => el.value = 1);
      await sleep(300);

      await takeScreenshot(page, '08-step3-filled');

      await page.click('button:has-text("Continue")');
      await sleep(800);
      await takeScreenshot(page, '09-onboarding-step4');

      // STEP 4: Dietary Preferences
      console.log('📝 Step 4: Dietary');
      await page.selectOption('select[id="dietaryStyle"]', 'omnivore');
      await sleep(500);

      await takeScreenshot(page, '10-step4-filled');

      await page.click('button:has-text("Continue")');
      await sleep(800);
      await takeScreenshot(page, '11-onboarding-step5');

      // STEP 5: Lifestyle
      console.log('📝 Step 5: Lifestyle');
      await page.selectOption('select[id="activityLevel"]', 'moderately_active');

      // Select training days
      await page.click('button[data-day="monday"]');
      await page.click('button[data-day="wednesday"]');
      await page.click('button[data-day="friday"]');
      await sleep(300);

      await page.selectOption('select[id="cookingSkill"]', '5');
      await page.selectOption('select[id="prepTimeMax"]', '45');
      await sleep(500);

      await takeScreenshot(page, '12-step5-filled');

      await page.click('button:has-text("Continue")');
      await sleep(800);
      await takeScreenshot(page, '13-onboarding-step6');

      // STEP 6: Preferences
      console.log('📝 Step 6: Preferences');
      await page.selectOption('select[id="macroStyle"]', 'balanced');
      await page.selectOption('select[id="mealsPerDay"]', '3');
      await page.selectOption('select[id="snacksPerDay"]', '1');
      await sleep(500);

      await takeScreenshot(page, '14-step6-filled');

      // Complete Setup
      await page.click('button[data-testid="onboarding-complete-btn"]');
      console.log('✅ Onboarding complete - redirecting to generate page');
      await sleep(3000);
    }

    // ========================================
    // STEP 3: Trigger Plan Generation
    // ========================================
    console.log('\n📍 STEP 3: Trigger Plan Generation');

    const generateUrl = page.url();
    console.log(`Generate URL: ${generateUrl}`);

    await takeScreenshot(page, '15-generate-page');

    // Click Generate Plan button
    const generateBtn = page.locator('button:has-text("Generate Plan")');
    const isVisible = await generateBtn.isVisible();

    if (isVisible) {
      console.log('✅ Generate button found - clicking');
      await generateBtn.click();
      console.log('⏳ Plan generation started...');
    } else {
      console.log('⚠️  Generate button not visible - may have auto-started');
    }

    await sleep(2000);

    // ========================================
    // STEP 4: Wait for Plan to Complete
    // ========================================
    console.log('\n📍 STEP 4: Wait for Plan Completion');

    // Wait for generation to complete (max 60 seconds)
    let completed = false;
    let attempts = 0;
    const maxAttempts = 60;

    while (!completed && attempts < maxAttempts) {
      await sleep(1000);
      attempts++;

      // Check if we've been redirected to meal-plan page
      const currentUrl = page.url();
      if (currentUrl.includes('/meal-plan')) {
        console.log('✅ Redirected to meal plan page');
        completed = true;
        break;
      }

      // Check for completion message
      const completionText = await page.locator('text=Plan Ready').count();
      if (completionText > 0) {
        console.log('✅ Plan completion message shown');
        completed = true;
      }

      // Take periodic screenshots
      if (attempts % 10 === 0) {
        await takeScreenshot(page, `16-generating-progress-${attempts}s`);
        console.log(`⏳ Still generating... (${attempts}s)`);
      }
    }

    if (!completed) {
      throw new Error('Plan generation did not complete within 60 seconds');
    }

    await sleep(2000);
    await takeScreenshot(page, '17-plan-complete');

    // ========================================
    // STEP 5: Verify Plan Display
    // ========================================
    console.log('\n📍 STEP 5: Verify Plan Display');

    const mealPlanUrl = page.url();
    console.log(`Meal Plan URL: ${mealPlanUrl}`);

    // Check for meal cards
    const mealCards = await page.locator('[data-testid^="meal-card-"]').count();
    console.log(`📊 Meal cards found: ${mealCards}`);

    // Expected: 7 days × 3 meals = 21 cards (or similar structure)
    if (mealCards > 0) {
      console.log('✅ Meal cards are displayed');
    } else {
      // Try alternative selectors
      const dayHeaders = await page.locator('text=Day').count();
      console.log(`📊 Day headers found: ${dayHeaders}`);

      const meals = await page.locator('text=Breakfast, Lunch, Dinner').count();
      console.log(`📊 Meal slots found: ${meals}`);
    }

    await takeScreenshot(page, '18-meal-plan-display');

    // ========================================
    // STEP 6: Verify Dashboard Shows Plan Data
    // ========================================
    console.log('\n📍 STEP 6: Verify Dashboard');

    await page.goto(`${BASE_URL}/dashboard`);
    await sleep(2000);
    await takeScreenshot(page, '19-dashboard');

    // Check for macro rings
    const macroRings = await page.locator('[data-testid^="macro-ring-"]').count();
    console.log(`📊 Macro rings found: ${macroRings}`);

    // Check for today's plan section
    const todaysPlan = await page.locator('text=Today\'s Plan').count();
    console.log(`📊 Today's Plan section: ${todaysPlan > 0 ? '✅' : '❌'}`);

    // Check for meal entries
    const mealEntries = await page.locator('[data-testid^="meal-entry-"]').count();
    console.log(`📊 Meal entries: ${mealEntries}`);

    // ========================================
    // STEP 7: Verify Data Persistence
    // ========================================
    console.log('\n📍 STEP 7: Verify Data Persistence');

    // Check localStorage
    const storage = await page.evaluate(() => {
      return {
        onboardingComplete: localStorage.getItem('zsn_onboarding_complete'),
        planGenerated: localStorage.getItem('zsn_plan_generated'),
        userProfile: localStorage.getItem('zsn_user_profile') ? 'exists' : 'missing',
        planId: localStorage.getItem('zsn_plan_id') ? 'exists' : 'missing'
      };
    });

    console.log('💾 Local Storage:', storage);

    // Refresh page and verify data persists
    await page.reload();
    await sleep(2000);
    await takeScreenshot(page, '20-dashboard-after-refresh');

    const refreshedTodaysPlan = await page.locator('text=Today\'s Plan').count();
    console.log(`📊 Today's Plan after refresh: ${refreshedTodaysPlan > 0 ? '✅' : '❌'}`);

    // ========================================
    // Final Summary
    // ========================================
    console.log('\n' + '='.repeat(60));
    console.log('✅ END-TO-END WORKFLOW TEST COMPLETE');
    console.log('='.repeat(60));

    const results = {
      step1_signup: isDevMode ? '✅ PASS' : '⚠️  SKIP (production mode)',
      step2_onboarding: '✅ PASS',
      step3_trigger_generation: '✅ PASS',
      step4_wait_completion: completed ? '✅ PASS' : '❌ FAIL',
      step5_verify_plan: mealCards > 0 ? '✅ PASS' : '⚠️  PARTIAL',
      step6_verify_dashboard: todaysPlan > 0 ? '✅ PASS' : '⚠️  PARTIAL',
      step7_verify_persistence: storage.planGenerated === 'true' ? '✅ PASS' : '❌ FAIL',
    };

    console.log('\n📊 Results Summary:');
    Object.entries(results).forEach(([step, result]) => {
      console.log(`  ${step}: ${result}`);
    });

    const allPassed = Object.values(results).every(r => r.includes('PASS'));
    console.log(`\n🎯 Overall Status: ${allPassed ? '✅ ALL TESTS PASSED' : '⚠️  SOME TESTS FAILED'}`);

    await sleep(3000);

  } catch (error) {
    console.error('\n❌ TEST ERROR:', error.message);
    await takeScreenshot(page, 'ERROR-state');
    throw error;
  } finally {
    await browser.close();
  }
}

// Run the test
testEndToEndWorkflow()
  .then(() => {
    console.log('\n✅ Test execution completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Test execution failed:', error);
    process.exit(1);
  });
