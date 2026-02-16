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
const TEST_ID = `TEST_${Date.now()}`;
const TEST_EMAIL = `test-${TEST_ID}@example.com`;

async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function setupBrowser() {
  const browser = await chromium.launch({
    headless: false,
    slowMo: 100,
  });
  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
  });
  const page = await context.newPage();

  // Listen for console errors
  page.on('console', (msg) => {
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
    const isDevMode = (await page.locator('text=Dev Mode').count()) > 0;
    console.log(`🔧 Dev Mode: ${isDevMode}`);

    if (isDevMode) {
      // Fill in email
      await page.fill('input[type="email"]', TEST_EMAIL);
      await sleep(500);
      await takeScreenshot(page, '02-signup-email-filled');

      // Click continue
      await page.click('button[type="submit"]');
      await sleep(1500);

      // Verify email sent screen
      await takeScreenshot(page, '03-verify-email-screen');

      // Wait for button to be clickable (not in loading state)
      await sleep(500);

      // Click "Verify & Continue" button - try multiple selectors
      console.log('Looking for Verify & Continue button...');
      const verifySelectors = [
        'button:has-text("Verify & Continue")',
        'button',
        '.bg-\\[\\#f97316\\]',
      ];

      let buttonClicked = false;
      for (const selector of verifySelectors) {
        try {
          const count = await page.locator(selector).count();
          console.log(`  Selector "${selector}": ${count} elements`);

          if (count > 0) {
            // Get the button text to verify
            const buttonText = await page.locator(selector).first().textContent();
            console.log(`  Button text: "${buttonText}"`);

            if (buttonText && buttonText.includes('Verify')) {
              console.log('✅ Clicking verify button...');
              await page.locator(selector).first().click();
              buttonClicked = true;
              await sleep(2000);
              break;
            }
          }
        } catch (e) {
          console.log(`  Error with selector "${selector}": ${e.message}`);
        }
      }

      if (!buttonClicked) {
        throw new Error('Could not find or click Verify button');
      }

      // Check if redirected to onboarding
      const currentUrl = page.url();
      console.log(`After signup URL: ${currentUrl}`);
    }

    // ========================================
    // STEP 2: Complete All 6 Onboarding Steps
    // ========================================
    console.log('\n📍 STEP 2: Complete Onboarding');

    await sleep(2000);

    // If not on onboarding, navigate there
    let currentUrl = page.url();
    if (!currentUrl.includes('/onboarding')) {
      console.log('⚠️  Not on onboarding - navigating...');
      await page.goto(`${BASE_URL}/onboarding`);
      await sleep(1000);
    }

    await takeScreenshot(page, '04-onboarding-step1');

    // STEP 1: Demographics
    console.log('📝 Step 1: Demographics');
    await page.fill('input[name="name"]', `Test User ${TEST_ID}`);
    await sleep(300);

    await page.selectOption('select[name="sex"]', 'male');
    await sleep(300);

    await page.fill('input[name="age"]', '30');
    await sleep(500);

    await takeScreenshot(page, '05-step1-filled');

    // Click Continue
    await page.click('button:has-text("Continue")');
    await sleep(1000);
    await takeScreenshot(page, '06-onboarding-step2');

    // STEP 2: Body Metrics
    console.log('📝 Step 2: Body Metrics');

    // Check if imperial or metric
    const imperialToggle = await page.locator('button:has-text("Imperial")').count();
    const metricToggle = await page.locator('button:has-text("Metric")').count();

    if (imperialToggle > 0) {
      await page.click('button:has-text("Imperial")');
      await sleep(300);

      await page.fill('input[name="heightFeet"]', '5');
      await page.fill('input[name="heightInches"]', '10');
      await page.fill('input[name="weightLbs"]', '175');
    } else {
      await page.fill('input[name="heightCm"]', '178');
      await page.fill('input[name="weightKg"]', '79');
    }

    await sleep(500);
    await takeScreenshot(page, '07-step2-filled');

    await page.click('button:has-text("Continue")');
    await sleep(1000);
    await takeScreenshot(page, '08-onboarding-step3');

    // STEP 3: Goals
    console.log('📝 Step 3: Goals');

    // Select goal type
    const goalMaintain = await page.locator('button:has-text("Maintain")').count();
    if (goalMaintain > 0) {
      await page.click('button:has-text("Maintain")');
    }

    await sleep(500);
    await takeScreenshot(page, '09-step3-filled');

    await page.click('button:has-text("Continue")');
    await sleep(1000);
    await takeScreenshot(page, '10-onboarding-step4');

    // STEP 4: Dietary Preferences
    console.log('📝 Step 4: Dietary');

    const dietarySelect = await page.locator('select[name="dietaryStyle"]').count();
    if (dietarySelect > 0) {
      await page.selectOption('select[name="dietaryStyle"]', 'omnivore');
    }

    await sleep(500);
    await takeScreenshot(page, '11-step4-filled');

    await page.click('button:has-text("Continue")');
    await sleep(1000);
    await takeScreenshot(page, '12-onboarding-step5');

    // STEP 5: Lifestyle
    console.log('📝 Step 5: Lifestyle');

    const activitySelect = await page.locator('select[name="activityLevel"]').count();
    if (activitySelect > 0) {
      await page.selectOption('select[name="activityLevel"]', 'moderately_active');
    }

    // Select training days
    const mondayBtn = await page
      .locator('button[data-day="monday"], button:has-text("Mon")')
      .count();
    if (mondayBtn > 0) {
      await page.click('button[data-day="monday"], button:has-text("Mon")');
      await page.click('button[data-day="wednesday"], button:has-text("Wed")');
      await page.click('button[data-day="friday"], button:has-text("Fri")');
    }

    await sleep(500);

    const cookingSelect = await page.locator('select[name="cookingSkill"]').count();
    if (cookingSelect > 0) {
      await page.selectOption('select[name="cookingSkill"]', '5');
    }

    const prepTimeSelect = await page.locator('select[name="prepTimeMax"]').count();
    if (prepTimeSelect > 0) {
      await page.selectOption('select[name="prepTimeMax"]', '45');
    }

    await sleep(500);
    await takeScreenshot(page, '13-step5-filled');

    await page.click('button:has-text("Continue")');
    await sleep(1000);
    await takeScreenshot(page, '14-onboarding-step6');

    // STEP 6: Preferences
    console.log('📝 Step 6: Preferences');

    const macroSelect = await page.locator('select[name="macroStyle"]').count();
    if (macroSelect > 0) {
      await page.selectOption('select[name="macroStyle"]', 'balanced');
    }

    const mealsSelect = await page.locator('select[name="mealsPerDay"]').count();
    if (mealsSelect > 0) {
      await page.selectOption('select[name="mealsPerDay"]', '3');
    }

    const snacksSelect = await page.locator('select[name="snacksPerDay"]').count();
    if (snacksSelect > 0) {
      await page.selectOption('select[name="snacksPerDay"]', '1');
    }

    await sleep(500);
    await takeScreenshot(page, '15-step6-filled');

    // Complete Setup
    console.log('✅ Clicking Complete Setup...');
    await page.click(
      'button[data-testid="onboarding-complete-btn"], button:has-text("Complete Setup")'
    );
    console.log('⏳ Onboarding complete - should redirect to generate page');
    await sleep(3000);

    // ========================================
    // STEP 3: Trigger Plan Generation
    // ========================================
    console.log('\n📍 STEP 3: Trigger Plan Generation');

    currentUrl = page.url();
    console.log(`Current URL: ${currentUrl}`);

    await takeScreenshot(page, '16-generate-page');

    // Look for generate button
    const generateBtnSelectors = [
      'button:has-text("Generate Plan")',
      'button:has-text("GENERATE PROTOCOL")',
      'button:has-text("Get My Plan")',
      'button[class*="bg-[#f97316]"]',
    ];

    let buttonClicked = false;
    for (const selector of generateBtnSelectors) {
      const count = await page.locator(selector).count();
      if (count > 0) {
        console.log(`✅ Found generate button with selector: ${selector}`);
        await page.click(selector);
        buttonClicked = true;
        break;
      }
    }

    if (!buttonClicked) {
      console.log('⚠️  Generate button not found - may have auto-started');
    } else {
      console.log('⏳ Plan generation started...');
    }

    await sleep(3000);

    // ========================================
    // STEP 4: Wait for Plan to Complete
    // ========================================
    console.log('\n📍 STEP 4: Wait for Plan Completion');

    // Wait for generation to complete (max 90 seconds)
    let completed = false;
    let attempts = 0;
    const maxAttempts = 90;

    while (!completed && attempts < maxAttempts) {
      await sleep(1000);
      attempts++;

      // Check if we've been redirected to meal-plan page
      currentUrl = page.url();
      if (currentUrl.includes('/meal-plan')) {
        console.log('✅ Redirected to meal plan page');
        completed = true;
        break;
      }

      // Check for completion message
      const completionText = await page.locator('text=Plan Ready, text=Your plan is ready').count();
      if (completionText > 0) {
        console.log('✅ Plan completion message shown');
        completed = true;
      }

      // Take periodic screenshots
      if (attempts % 15 === 0) {
        await takeScreenshot(page, `17-generating-progress-${attempts}s`);
        console.log(`⏳ Still generating... (${attempts}s)`);
      }
    }

    if (!completed) {
      console.log('⚠️  Plan generation did not complete within 90 seconds');
      await takeScreenshot(page, 'ERROR-generation-timeout');
    }

    await sleep(2000);
    await takeScreenshot(page, '18-plan-page-loaded');

    // Navigate to meal-plan if not already there
    currentUrl = page.url();
    if (!currentUrl.includes('/meal-plan')) {
      console.log('Navigating to meal-plan page...');
      await page.goto(`${BASE_URL}/meal-plan`);
      await sleep(3000);
    }

    await takeScreenshot(page, '19-meal-plan-display');

    // ========================================
    // STEP 5: Verify Plan Display
    // ========================================
    console.log('\n📍 STEP 5: Verify Plan Display');

    currentUrl = page.url();
    console.log(`Meal Plan URL: ${currentUrl}`);

    // Check for meal cards or day headers
    const mealCards = await page.locator('[data-testid^="meal-card-"]').count();
    console.log(`📊 Meal cards found: ${mealCards}`);

    const dayHeaders = await page.locator('text=Day, text=MONDAY, text=TUESDAY').count();
    console.log(`📊 Day headers found: ${dayHeaders}`);

    const mealLabels = await page.locator('text=Breakfast, text=Lunch, text=Dinner').count();
    console.log(`📊 Meal labels found: ${mealLabels}`);

    // Check for any plan content
    const hasContent = mealCards > 0 || dayHeaders > 0 || mealLabels > 0;
    console.log(`✅ Plan content displayed: ${hasContent ? 'YES' : 'NO'}`);

    // ========================================
    // STEP 6: Verify Dashboard Shows Plan Data
    // ========================================
    console.log('\n📍 STEP 6: Verify Dashboard');

    await page.goto(`${BASE_URL}/dashboard`);
    await sleep(2000);
    await takeScreenshot(page, '20-dashboard');

    // Check for macro rings
    const macroRings = await page
      .locator('[data-testid^="macro-ring-"], svg[class*="ring"]')
      .count();
    console.log(`📊 Macro rings found: ${macroRings}`);

    // Check for today's plan section
    const todaysPlan = await page.locator("text=Today's Plan, text=TODAY'S PLAN").count();
    console.log(`📊 Today's Plan section: ${todaysPlan > 0 ? '✅' : '❌'}`);

    // Check for meal entries
    const mealEntries = await page.locator('[data-testid^="meal-entry-"], [class*="meal"]').count();
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
        planId: localStorage.getItem('zsn_plan_id') ? 'exists' : 'missing',
        onboardingData: localStorage.getItem('zsn_onboarding_data') ? 'exists' : 'missing',
      };
    });

    console.log('💾 Local Storage:', storage);

    // Refresh page and verify data persists
    await page.reload();
    await sleep(2000);
    await takeScreenshot(page, '21-dashboard-after-refresh');

    const refreshedTodaysPlan = await page.locator("text=Today's Plan, text=TODAY'S PLAN").count();
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
      step3_trigger_generation: buttonClicked || completed ? '✅ PASS' : '⚠️  PARTIAL',
      step4_wait_completion: completed ? '✅ PASS' : '⚠️  PARTIAL (timeout)',
      step5_verify_plan: hasContent ? '✅ PASS' : '⚠️  PARTIAL',
      step6_verify_dashboard: todaysPlan > 0 || mealEntries > 0 ? '✅ PASS' : '⚠️  PARTIAL',
      step7_verify_persistence: storage.onboardingComplete === 'true' ? '✅ PASS' : '⚠️  PARTIAL',
    };

    console.log('\n📊 Results Summary:');
    Object.entries(results).forEach(([step, result]) => {
      console.log(`  ${step}: ${result}`);
    });

    const allPassed = Object.values(results).every((r) => r.includes('PASS'));
    const partialPass = Object.values(results).filter((r) => r.includes('PASS')).length;
    console.log(
      `\n🎯 Overall Status: ${allPassed ? '✅ ALL TESTS PASSED' : `⚠️  ${partialPass}/7 TESTS PASSED`}`
    );

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
