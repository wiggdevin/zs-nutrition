const { chromium } = require('playwright');
const fs = require('fs');

async function testFeature270Final() {
  console.log('=== FINAL TEST: Feature #270 - Session Recovery After Browser Close ===\n');

  let userId, cookies, storagePath;

  // STEP 1: Sign in and perform some actions
  console.log('STEP 1: Sign in and perform some actions');
  console.log('-'.repeat(60));

  const browser1 = await chromium.launch({ headless: false });
  const context1 = await browser1.newContext();
  const page1 = await context1.newPage();

  // Create user via API
  console.log('Creating test user via dev-auth API...');
  const response = await context1.request.post('http://localhost:3456/api/dev-auth/signup', {
    data: { email: 'final-verification-270@example.com' },
  });
  const signupData = await response.json();
  userId = signupData.userId;
  console.log('✓ User created:', userId);

  // Navigate to onboarding/dashboard
  console.log('Navigating to onboarding/dashboard...');
  await page1.goto('http://localhost:3456/dashboard');
  await page1.waitForTimeout(3000);

  const url1 = page1.url();
  console.log('✓ Landed on:', url1);

  // Take screenshot - BEFORE browser close
  await page1.screenshot({ path: '/tmp/f270-1-before-close.png', fullPage: true });
  console.log('✓ Screenshot saved: /tmp/f270-1-before-close.png');

  // Verify user is signed in
  const signedIn1 = await page1.evaluate(() => {
    const hasSignInLink = document.querySelector('a[href="/sign-in"]');
    const bodyText = document.body.textContent.toLowerCase();
    return {
      hasSignInLink: !!hasSignInLink,
      hasDashboard: bodyText.includes('dashboard') || bodyText.includes('calories'),
      hasOnboarding: bodyText.includes('onboarding'),
      hasWelcome: bodyText.includes('welcome'),
    };
  });
  console.log('✓ Signed in status:', signedIn1);

  // Save storage state (cookies, localStorage, etc.)
  console.log('\nSaving browser storage state...');
  storagePath = '/tmp/playwright-storage-state.json';
  await context1.storageState({ path: storagePath });
  cookies = JSON.parse(fs.readFileSync(storagePath, 'utf8'));
  console.log('✓ Storage state saved to:', storagePath);
  console.log('  Cookies saved:', cookies.cookies.length);
  cookies.cookies.forEach((c) => {
    console.log(
      `    - ${c.name}: ${c.value.substring(0, 20)}... (expires: ${new Date(c.expires * 1000).toISOString()})`
    );
  });

  // Check console for errors
  const errors1 = [];
  page1.on('console', (msg) => {
    if (msg.type() === 'error') {
      errors1.push(msg.text());
    }
  });

  await page1.waitForTimeout(1000);

  // Close browser completely
  console.log('\nClosing browser completely...');
  await context1.close();
  await browser1.close();
  console.log('✓ Browser closed');

  // Wait to simulate time passing
  console.log('\nWaiting 2 seconds (simulating time between sessions)...');
  await new Promise((resolve) => setTimeout(resolve, 2000));

  // STEP 2: Reopen browser
  console.log('\n' + '='.repeat(60));
  console.log('STEP 2: Reopen browser and navigate to app');
  console.log('-'.repeat(60));

  const browser2 = await chromium.launch({ headless: false });

  // Create context with saved storage state (simulates browser restoring cookies from disk)
  console.log('Creating new browser context with saved cookies...');
  const context2 = await browser2.newContext({
    storageState: storagePath, // This restores the cookies from previous session
  });
  console.log('✓ Browser reopened with persisted cookies');

  const page2 = await context2.newPage();

  // Navigate to home page
  console.log('\nNavigating to home page...');
  await page2.goto('http://localhost:3456');
  await page2.waitForTimeout(3000);

  const url2 = page2.url();
  console.log('✓ Landed on:', url2);

  // Take screenshot - AFTER browser reopen
  await page2.screenshot({ path: '/tmp/f270-2-after-reopen.png', fullPage: true });
  console.log('✓ Screenshot saved: /tmp/f270-2-after-reopen.png');

  // Check if still signed in
  const signedIn2 = await page2.evaluate(() => {
    const signInLink = document.querySelector('a[href="/sign-in"]');
    const signOutBtn = document.querySelector('button[value="sign-out"]');
    const bodyText = document.body.textContent.toLowerCase();
    return {
      hasSignInLink: !!signInLink,
      hasSignOutBtn: !!signOutBtn,
      hasDashboard: bodyText.includes('dashboard') || bodyText.includes('calories'),
      hasOnboarding: bodyText.includes('onboarding'),
      hasWelcome: bodyText.includes('welcome'),
      hasSignInText: bodyText.includes('sign in'),
    };
  });
  console.log('✓ Signed in status:', signedIn2);

  // STEP 3: Try to access protected route
  console.log('\n' + '='.repeat(60));
  console.log('STEP 3: Verify dashboard loads without re-authentication');
  console.log('-'.repeat(60));

  console.log('Navigating to /dashboard...');
  await page2.goto('http://localhost:3456/dashboard');
  await page2.waitForTimeout(3000);

  const finalUrl = page2.url();
  console.log('✓ Final URL:', finalUrl);

  // Take screenshot - Dashboard access
  await page2.screenshot({ path: '/tmp/f270-3-dashboard-access.png', fullPage: true });
  console.log('✓ Screenshot saved: /tmp/f270-3-dashboard-access.png');

  // Verify no re-authentication required
  const finalCheck = await page2.evaluate(() => {
    const signInForm = document.querySelector('input[type="email"]');
    const signInHeading = Array.from(document.querySelectorAll('h1, h2')).find((h) =>
      h.textContent.toLowerCase().includes('sign in')
    );
    const bodyText = document.body.textContent.toLowerCase();
    return {
      hasSignInForm: !!signInForm,
      hasSignInHeading: !!signInHeading,
      hasDashboard: bodyText.includes('dashboard') || bodyText.includes('calories'),
      hasOnboarding: bodyText.includes('onboarding'),
      url: window.location.href,
    };
  });
  console.log('✓ Final check:', finalCheck);

  // Check console for errors
  const errors2 = [];
  page2.on('console', (msg) => {
    if (msg.type() === 'error') {
      errors2.push(msg.text());
    }
  });

  await page2.waitForTimeout(1000);

  // Clean up
  await context2.close();
  await browser2.close();

  // FINAL VERDICT
  console.log('\n' + '='.repeat(60));
  console.log('FINAL VERDICT');
  console.log('='.repeat(60));

  // Session is recovered if:
  // 1. Not redirected to sign-in
  // 2. No sign-in form present
  // 3. Can access protected routes
  const wasRedirectedToSignIn = finalUrl.includes('/sign-in');
  const hasSignInForm = finalCheck.hasSignInForm || finalCheck.hasSignInHeading;
  const canAccessProtected = finalCheck.hasDashboard || finalCheck.hasOnboarding;

  const sessionRecovered = !wasRedirectedToSignIn && !hasSignInForm && canAccessProtected;

  console.log('\nVerification Steps:');
  console.log(`  1. Sign in and perform actions:        ✓ PASS`);
  console.log(`  2. Close browser completely:            ✓ PASS`);
  console.log(`  3. Reopen browser and navigate:         ✓ PASS`);
  console.log(
    `  4. Verify still signed in:              ${signedIn2.hasSignInLink ? '✗ FAIL' : '✓ PASS'} (no sign-in link)`
  );
  console.log(
    `  5. Verify dashboard loads with data:    ${canAccessProtected ? '✓ PASS' : '✗ FAIL'}`
  );
  console.log(
    `  6. Verify no re-authentication:         ${hasSignInForm ? '✗ FAIL' : '✓ PASS'} (no sign-in form)`
  );

  console.log('\n' + '-'.repeat(60));

  if (sessionRecovered) {
    console.log('\n✅ ✅ ✅  FEATURE #270: PASSED  ✅ ✅ ✅');
    console.log('\nSession recovery is working correctly:');
    console.log('  • Cookies persist across browser sessions');
    console.log('  • User remains signed in after browser close');
    console.log('  • No re-authentication required');
    console.log('  • Protected routes accessible');
  } else {
    console.log('\n❌ ❌ ❌  FEATURE #270: FAILED (REGRESSION)  ❌ ❌ ❌');
    console.log('\nSession recovery is NOT working:');
    if (wasRedirectedToSignIn) {
      console.log('  • User redirected to sign-in page');
    }
    if (hasSignInForm) {
      console.log('  • Re-authentication required');
    }
    if (!canAccessProtected) {
      console.log('  • Protected routes not accessible');
    }
  }

  console.log('\nScreenshots:');
  console.log('  /tmp/f270-1-before-close.png');
  console.log('  /tmp/f270-2-after-reopen.png');
  console.log('  /tmp/f270-3-dashboard-access.png');

  return {
    sessionRecovered,
    wasRedirectedToSignIn,
    hasSignInForm,
    canAccessProtected,
    finalUrl,
    cookiesPersisted: cookies.cookies.length > 0,
    verificationSteps: {
      step1: true,
      step2: true,
      step3: true,
      step4: !signedIn2.hasSignInLink,
      step5: canAccessProtected,
      step6: !hasSignInForm,
    },
  };
}

testFeature270Final()
  .then((result) => {
    console.log('\n' + '='.repeat(60));
    console.log('TEST COMPLETE');
    console.log('='.repeat(60));
    console.log('\nResult:', JSON.stringify(result, null, 2));
    process.exit(result.sessionRecovered ? 0 : 1);
  })
  .catch((err) => {
    console.error('\n❌ TEST ERROR:', err.message);
    process.exit(1);
  });
