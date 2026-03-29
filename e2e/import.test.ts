import { test, expect } from './fixtures'

test('navigates to import page via More menu', async ({ page }) => {
  await page.goto('/')
  await page.click('#nav-more')
  await page.click('#nav-import')

  await expect(page).toHaveURL('/import')
  await expect(page.locator('h2')).toHaveText('Import from Anki')
  await expect(page.locator('#import-file-label')).toBeVisible()
})

test('shows error for invalid file', async ({ page }) => {
  await page.goto('/import')

  // Upload a non-apkg file
  const fileInput = page.locator('#import-file-input')
  await fileInput.setInputFiles({
    name: 'test.apkg',
    mimeType: 'application/octet-stream',
    buffer: Buffer.from('not a zip file'),
  })

  await expect(page.locator('#import-error')).toBeVisible()
  await expect(page.locator('#import-error')).toContainText('Invalid ZIP')
})
