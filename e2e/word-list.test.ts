import { test, expect } from '@playwright/test'

test('empty word list shows "No words found" instead of loading', async ({ page }) => {
  await page.goto('/words')

  // Should show empty state, not loading
  await expect(page.locator('#empty-state')).toHaveText('No words found.')
  await expect(page.locator('.loading-text')).not.toBeVisible()
})
