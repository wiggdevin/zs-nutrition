const { chromium } = require('playwright');

async function testFeature270() {
  console.log('=== Testing Feature #270: Session Recovery After Browser Close ===\n');

  // Step 1: Sign in and perform some actions
  console.log('Step 1: Signing in and performing actions...');
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();

  // Create user and get cookie
  const response = await context.request.post('http://localhost:3456/api/dev-auth/signup', {
    data: { email: 'feature-270-recovery@example.com' },
  });
  const signupData = await response.json();
  console.log('✅ User created:', signupData.userId);

  // Navigate to dashboard
  const page = await context.newPage();
  await page.goto('http://localhost:3456/dashboard');
  await page.waitForTimeout(3000);

  // Take screenshot
  await page.screenshot({ path: '/tmp/feature-270-step1-dashboard.png', fullPage: true });
  console.log('✅ Dashboard loaded - screenshot saved');

  // Check for console errors
  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      console.log('❌ Console error:', msg.text());
    }
  });

  // Verify we're on dashboard
  const url = page.url();
  if (url.includes('/dashboard')) {
    console.log('✅ Successfully navigated to dashboard');
  } else {
    console.log('❌ Not on dashboard:', url);
  }

  // Check if user data is loaded
  const hasUserData = await page.evaluate(() => {
    const welcome = document.querySelector('h1, h2');
    return welcome && welcome.textContent.includes('Welcome');
  });
  console.log('✅ User data loaded:', hasUserData);

  await page.waitForTimeout(2000);

  // Step 2: Close browser completely
  console.log('\nStep 2: Closing browser completely...');
  await context.close();
  await browser.close();
  console.log('✅ Browser closed');

  // Step 3: Reopen browser and navigate to app
  console.log('\nStep 3: Reopening browser and navigating to app...');
  await new Promise((resolve) => setTimeout(resolve, 2000)); // Wait 2 seconds

  const browser2 = await chromium.launch({ headless: false });
  const context2 = await browser2.newContext();

  // Navigate to home page first
  const page2 = await context2.newPage();
  await page2.goto('http://localhost:3456');
  await page2.waitForTimeout(2000);

  // Take screenshot of home page
  await page2.screenshot({ path: '/tmp/feature-270-step3-home.png', fullPage: true });
  console.log('✅ Navigated to home page');

  // Check if we're signed in
  const stillSignedIn = await page2.evaluate(() => {
    // Look for sign-out button or user menu
    const signOutBtn = document.querySelector('button[value="sign-out"]');
    const userMenu = document.querySelector('[data-testid="user-menu"]');
    return !!(signOutBtn || userMenu);
  });

  if (stillSignedIn) {
    console.log('✅ Still signed in after browser close');
  } else {
    console.log('⚠️  Not signed in - checking redirect behavior...');
    // Check if we get redirected to sign-in when trying to access dashboard
  }

  await page2.waitForTimeout(2000);

  // Step 4: Try to access dashboard
  console.log('\nStep 4: Attempting to access dashboard...');
  await page2.goto('http://localhost:3456/dashboard');
  await page2.waitForTimeout(3000);

  // Take screenshot
  await page2.screenshot({
    path: '/tmp/feature-270-step4-dashboard-after-reopen.png',
    fullPage: true,
  });
  console.log('✅ Screenshot saved');

  // Step 5: Verify dashboard loads with user data
  console.log('\nStep 5: Verifying dashboard loads with user data...');

  const finalUrl = page2.url();
  if (finalUrl.includes('/dashboard')) {
    console.log('✅ Dashboard accessible (not redirected to sign-in)');
  } else if (finalUrl.includes('/sign-in')) {
    console.log('❌ Redirected to sign-in - session NOT recovered');
  } else {
    console.log('⚠️  Unexpected URL:', finalUrl);
  }

  // Check for user data
  const dashboardLoaded = await page2.evaluate(() => {
    const heading = document.querySelector('h1, h2');
    const hasContent =
      document.body.textContent.includes('Welcome') ||
      document.body.textContent.includes('Dashboard') ||
      document.body.textContent.includes('calories');
    return hasContent;
  });

  if (dashboardLoaded) {
    console.log('✅ Dashboard loaded with user data');
  } else {
    console.log('❌ Dashboard did not load properly');
  }

  // Check console for errors
  const errors = [];
  page2.on('console', (msg) => {
    if (msg.type() === 'error') {
      errors.push(msg.text());
    }
  });

  await page2.waitForTimeout(2000);

  // Step 6: Verify no re-authentication required
  console.log('\nStep 6: Verifying no re-authentication required...');

  const hasSignInForm = await page2.evaluate(() => {
    const emailInput = document.querySelector('input[type="email"]');
    const signInHeading = document.querySelector('h1, h2');
    return emailInput || (signInHeading && signInHeading.textContent.includes('Sign in'));
  });

  if (!hasSignInForm) {
    console.log('✅ No re-authentication required - session recovered successfully');
  } else {
    console.log('❌ Re-authentication required - session NOT recovered');
  }

  await browser2.close();

  console.log('\n=== Test Complete ===');
  console.log('Screenshots saved:');
  console.log('  - /tmp/feature-270-step1-dashboard.png');
  console.log('  - /tmp/feature-270-step3-home.png');
  console.log('  - /tmp/feature-270-step4-dashboard-after-reopen.png');

  return {
    sessionRecovered: !hasSignInForm && finalUrl.includes('/dashboard'),
    stillSignedIn,
    dashboardLoaded,
  };
}

testFeature270()
  .then((result) => {
    console.log('\nResult:', JSON.stringify(result, null, 2));
    process.exit(result.sessionRecovered ? 0 : 1);
  })
  .catch((err) => {
    console.error('Error:', err);
    process.exit(1);
  });
