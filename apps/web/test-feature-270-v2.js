const { chromium } = require('playwright');

async function testFeature270Correctly() {
  console.log('=== Testing Feature #270: Session Recovery After Browser Close ===\n');
  console.log(
    'This test properly simulates browser close/reopen by saving and restoring cookies\n'
  );

  // Step 1: Sign in and perform some actions
  console.log('Step 1: Signing in and performing actions...');
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();

  // Create user and get cookie via API
  const response = await context.request.post('http://localhost:3456/api/dev-auth/signup', {
    data: { email: 'feature-270-correct-test@example.com' },
  });
  const signupData = await response.json();
  console.log('✅ User created:', signupData.userId);

  // Navigate to dashboard
  const page = await context.newPage();
  await page.goto('http://localhost:3456/dashboard');
  await page.waitForTimeout(3000);

  // Take screenshot
  await page.screenshot({ path: '/tmp/feature-270-v2-step1-dashboard.png', fullPage: true });
  console.log('✅ Dashboard loaded - screenshot saved');

  // Verify we're on dashboard (might be onboarding if new user)
  const url = page.url();
  console.log('  Current URL:', url);

  // Check if user data is loaded
  const pageContent = await page.evaluate(() => {
    const heading = document.querySelector('h1, h2');
    return {
      heading: heading ? heading.textContent : 'none',
      hasWelcome: document.body.textContent.includes('Welcome'),
      hasOnboarding: document.body.textContent.toLowerCase().includes('onboarding'),
    };
  });
  console.log('  Page content:', pageContent);

  // Check console for errors
  const consoleErrors = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      consoleErrors.push(msg.text());
    }
  });

  await page.waitForTimeout(2000);

  // Step 2: Save browser state (cookies, localStorage, etc.)
  console.log('\nStep 2: Saving browser state (simulating before browser close)...');
  const storageState = await context.storageState();
  console.log('✅ Storage state saved, cookies count:', storageState.cookies.length);
  console.log(
    '  Cookies:',
    storageState.cookies.map((c) => ({ name: c.name, expires: c.expires }))
  );

  // Close browser completely
  await context.close();
  await browser.close();
  console.log('✅ Browser closed completely');

  // Wait a bit to simulate time passing
  await new Promise((resolve) => setTimeout(resolve, 2000));

  // Step 3: Reopen browser and restore state (simulates browser reopening with persisted cookies)
  console.log('\nStep 3: Reopening browser and restoring session...');

  const browser2 = await chromium.launch({ headless: false });

  // Create context with saved state (this simulates browser reading cookies from disk)
  const context2 = await browser2.newContext({
    storageState: storageState, // Restore cookies from previous session
  });

  console.log('✅ Browser reopened with restored cookies');

  // Navigate to home page
  const page2 = await context2.newPage();
  await page2.goto('http://localhost:3456');
  await page2.waitForTimeout(3000);

  // Take screenshot
  await page2.screenshot({ path: '/tmp/feature-270-v2-step3-home.png', fullPage: true });
  console.log('✅ Navigated to home page - screenshot saved');

  // Check current URL
  const homeUrl = page2.url();
  console.log('  Current URL:', homeUrl);

  // Check if we're still signed in
  const signedInCheck = await page2.evaluate(() => {
    // Look for sign-in link vs user menu
    const signInLink = document.querySelector('a[href="/sign-in"]');
    const signOutBtn = document.querySelector('button[value="sign-out"]');
    return {
      hasSignInLink: !!signInLink,
      hasSignOutBtn: !!signOutBtn,
    };
  });
  console.log('  Signed in check:', signedInCheck);

  // Step 4: Try to access protected route (dashboard)
  console.log('\nStep 4: Attempting to access dashboard...');
  await page2.goto('http://localhost:3456/dashboard');
  await page2.waitForTimeout(3000);

  // Take screenshot
  await page2.screenshot({ path: '/tmp/feature-270-v2-step4-dashboard.png', fullPage: true });
  console.log('✅ Screenshot saved');

  // Step 5: Verify dashboard loads (not redirected to sign-in)
  console.log('\nStep 5: Verifying session recovery...');

  const finalUrl = page2.url();
  console.log('  Final URL:', finalUrl);

  const isDashboard = finalUrl.includes('/dashboard') && !finalUrl.includes('/sign-in');
  const isSignIn = finalUrl.includes('/sign-in');
  const isOnboarding = finalUrl.includes('/onboarding');

  // Check if we can see dashboard content
  const dashboardCheck = await page2.evaluate(() => {
    const signInHeading = document.querySelector('h1, h2');
    const hasSignInForm = document.querySelector('input[type="email"]');
    const bodyText = document.body.textContent.toLowerCase();

    return {
      hasSignInForm: !!hasSignInForm,
      heading: signInHeading ? signInHeading.textContent : 'none',
      hasDashboard:
        bodyText.includes('dashboard') ||
        bodyText.includes('calories') ||
        bodyText.includes('protein'),
      hasOnboarding: bodyText.includes('onboarding'),
      hasSignInText: bodyText.includes('sign in'),
    };
  });
  console.log('  Dashboard check:', dashboardCheck);

  // Check console for errors
  const consoleErrors2 = [];
  page2.on('console', (msg) => {
    if (msg.type() === 'error') {
      consoleErrors2.push(msg.text());
    }
  });

  await page2.waitForTimeout(2000);

  // Step 6: Determine if session was recovered
  console.log('\nStep 6: Final verification...');

  // Session is recovered if:
  // 1. We're not on sign-in page
  // 2. We can access protected routes (dashboard or onboarding)
  // 3. No re-authentication required
  const sessionRecovered =
    !isSignIn &&
    !dashboardCheck.hasSignInForm &&
    (isDashboard || isOnboarding || dashboardCheck.hasDashboard);

  if (sessionRecovered) {
    console.log('✅ SESSION RECOVERED SUCCESSFULLY');
    console.log('   - User remained signed in after browser close');
    console.log('   - Dashboard accessible without re-authentication');
    console.log('   - Cookies persisted correctly');
  } else {
    console.log('❌ SESSION NOT RECOVERED - REGRESSION FOUND');
    if (isSignIn) {
      console.log('   - Redirected to sign-in page');
    }
    if (dashboardCheck.hasSignInForm) {
      console.log('   - Sign-in form present');
    }
  }

  // Clean up
  await context2.close();
  await browser2.close();

  console.log('\n=== Test Complete ===');
  console.log('Screenshots:');
  console.log('  - /tmp/feature-270-v2-step1-dashboard.png');
  console.log('  - /tmp/feature-270-v2-step3-home.png');
  console.log('  - /tmp/feature-270-v2-step4-dashboard.png');

  return {
    sessionRecovered,
    finalUrl,
    isSignIn,
    isDashboard,
    isOnboarding,
    dashboardCheck,
    cookiesCount: storageState.cookies.length,
  };
}

testFeature270Correctly()
  .then((result) => {
    console.log('\n=== RESULT ===');
    console.log(JSON.stringify(result, null, 2));
    process.exit(result.sessionRecovered ? 0 : 1);
  })
  .catch((err) => {
    console.error('Error:', err);
    process.exit(1);
  });
