#!/usr/bin/env python3
"""Quick script to view the meal plan page - signs in first"""

from playwright.sync_api import sync_playwright

BASE_URL = "http://localhost:3456"
# Use the email from the test we just ran
TEST_EMAIL = "test-e2e-b1549ea6@example.com"

with sync_playwright() as p:
    browser = p.chromium.launch(headless=False)
    context = browser.new_context(viewport={"width": 1600, "height": 1000})
    page = context.new_page()

    # Sign in first
    print("Signing in...")
    page.goto(f"{BASE_URL}/dev-signin")
    page.wait_for_load_state("networkidle")
    page.locator('input[type="email"]').fill(TEST_EMAIL)
    page.locator('button:has-text("Sign In")').click()
    page.wait_for_timeout(2000)
    print(f"Signed in as {TEST_EMAIL}")

    # Navigate to meal plan
    print("Navigating to meal plan...")
    page.goto(f"{BASE_URL}/meal-plan")
    page.wait_for_load_state("networkidle")
    page.wait_for_timeout(2000)

    # Take a high-res screenshot
    page.screenshot(path="meal-plan-view.png", full_page=True)
    print("Screenshot saved to meal-plan-view.png")

    # Keep browser open for viewing
    print("Browser open for 60 seconds - you can interact with it!")
    page.wait_for_timeout(60000)

    browser.close()
