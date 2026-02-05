import { test, expect } from '@playwright/test'

test('landing page loads', async ({ page }) => {
  await page.goto('/')
  await expect(page).toHaveTitle(/Zero Sum/)
})

test('sign-in page loads', async ({ page }) => {
  await page.goto('/sign-in')
  await expect(page.locator('text=Sign in')).toBeVisible()
})

test('unauthenticated user redirected from dashboard', async ({ page }) => {
  await page.goto('/dashboard')
  await expect(page).toHaveURL(/sign-in/)
})
