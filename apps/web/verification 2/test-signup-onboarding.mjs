import { chromium } from 'playwright';
import path from 'path';
import { fileURLToPath } from 'url';

var __dirname = path.dirname(fileURLToPath(import.meta.url));
var SCREENSHOT_DIR = __dirname;
var BASE_URL = 'http://127.0.0.1:3007';

var results = [];
function check(condition, label) {
  var status = condition ? 'PASS' : 'FAIL';
  results.push({ label, status });
  console.log('  [' + status + '] ' + label);
}

(async () => {
  console.log('=== Sign-Up to Onboarding E2E Test ===\n');

  var browser = await chromium.launch({ headless: true });
  var context = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  var page = await context.newPage();

  try {
    console.log('Step 1: Navigate to /sign-up');
    await page.goto(BASE_URL + '/sign-up', { waitUntil: 'networkidle' });

    console.log('Step 2: Screenshot sign-up form');
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '01-signup-form.png'), fullPage: true });

    var emailInput = page.locator('#email');
    await emailInput.waitFor({ state: 'visible', timeout: 5000 });
    check(await emailInput.isVisible(), 'Email input is visible on sign-up page');

    var createAccountHeading = page.locator('h2:has-text("Create your account")');
    check(await createAccountHeading.isVisible(), '"Create your account" heading is visible');

    var testEmail = 'test_feature61_verify@example.com';
    console.log('Step 3: Enter email: ' + testEmail);
    await emailInput.fill(testEmail);
    check((await emailInput.inputValue()) === testEmail, 'Email field contains the test email');

    console.log('Step 4: Click Continue button');
    var continueButton = page.locator('button[type="submit"]:has-text("Continue")');
    check(await continueButton.isVisible(), 'Continue button is visible');
    await continueButton.click();

    console.log('  Waiting for verification step...');
    var verifyButton = page.locator('button:has-text("Verify & Continue")');
    await verifyButton.waitFor({ state: 'visible', timeout: 5000 });

    console.log('Step 5: Screenshot verification step');
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '02-verify-step.png'), fullPage: true });

    var checkEmailHeading = page.locator('h2:has-text("Check your email")');
    check(await checkEmailHeading.isVisible(), '"Check your email" heading is visible');

    var emailDisplay = page.locator('text=' + testEmail);
    check(await emailDisplay.isVisible(), 'Entered email is displayed in verification step');

    check(await verifyButton.isVisible(), '"Verify & Continue" button is visible');

    console.log('Step 6: Click "Verify & Continue"');
    await verifyButton.click();

    console.log('Step 7: Wait for redirect to /onboarding');
    await page.waitForURL('**/onboarding**', { timeout: 15000 });

    console.log('Step 8: Screenshot onboarding page');
    await page.waitForSelector('h1:has-text("Welcome to Zero Sum")', { timeout: 10000 });
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, '03-onboarding-page.png'), fullPage: true });

    console.log('Step 9: Verify URL');
    var currentUrl = page.url();
    check(currentUrl.includes('/onboarding'), 'URL contains /onboarding (actual: ' + currentUrl + ')');

    console.log('Step 10: Verify Step 1 content');
    var stepTitle = page.locator('h2:has-text("Demographics")');
    check(await stepTitle.isVisible(), 'Step 1 title "Demographics" is visible');

    var welcomeHeading = page.locator('h1:has-text("Welcome to Zero Sum")');
    check(await welcomeHeading.isVisible(), '"Welcome to Zero Sum" heading is visible');

    console.log('Step 11: Verify progress bar');
    var stepIndicator = page.locator('text=Step 1 of 6');
    check(await stepIndicator.isVisible(), 'Progress indicator shows "Step 1 of 6"');

    var stepCircles = page.locator('.rounded-full.text-xs.font-bold');
    var circleCount = await stepCircles.count();
    check(circleCount === 6, 'Progress bar has 6 step circles (actual: ' + circleCount + ')');

    var firstCircle = stepCircles.first();
    var firstCircleClasses = await firstCircle.getAttribute('class');
    check(
      firstCircleClasses && firstCircleClasses.includes('bg-[#f97316]'),
      'First step circle is highlighted (active)'
    );

  } catch (err) {
    console.error('\n  ERROR: ' + err.message);
    try {
      await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'error-screenshot.png'), fullPage: true });
      console.log('  Error screenshot saved.');
    } catch (e) {}
    results.push({ label: 'Unexpected error: ' + err.message, status: 'FAIL' });
  } finally {
    await browser.close();
  }

  var passed = results.filter(r => r.status === 'PASS').length;
  var failed = results.filter(r => r.status === 'FAIL').length;
  console.log('\n=== Results: ' + passed + ' passed, ' + failed + ' failed out of ' + results.length + ' checks ===');

  if (failed > 0) {
    console.log('\nFailed checks:');
    results.filter(r => r.status === 'FAIL').forEach(r => console.log('  - ' + r.label));
    process.exit(1);
  } else {
    console.log('\nAll checks passed!');
    process.exit(0);
  }
})();
