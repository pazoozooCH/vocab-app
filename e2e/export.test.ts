import { test, expect } from './fixtures'

const mockTranslation = {
  word: 'hello',
  translations: ['hallo'],
  sentencesSource: ['1. **Hello**, how are you?'],
  sentencesGerman: ['1. **Hallo**, wie geht es dir?'],
}

function mockTranslateApi(page: import('@playwright/test').Page) {
  return page.route('**/api/translate', async (route) => {
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(mockTranslation),
    })
  })
}

test.describe('Export flow', () => {
  test('export words, confirm, and verify pending count updates', async ({ page }) => {
    await mockTranslateApi(page)

    // Add a word first
    await page.goto('/')
    await page.click('#lang-en')
    await page.selectOption('#deck-select', '__new__')
    await page.locator('#new-deck-input').fill('English::Export')
    await page.click('#create-deck-btn')
    await page.locator('#word-input').fill('hello')
    await page.click('#add-word-btn')
    await expect(page.locator('#add-word-result')).toBeVisible()

    // Navigate to export page
    await page.click('#nav-export')

    // Should show 1 pending word
    await expect(page.locator('#export-summary')).toContainText('1 pending word')

    // Export button should be visible
    await expect(page.locator('#export-btn')).toBeVisible()

    // Trigger export (intercept the download)
    const downloadPromise = page.waitForEvent('download')
    await page.click('#export-btn')
    const download = await downloadPromise
    expect(download.suggestedFilename()).toContain('.apkg')

    // Export history should appear with pending confirmation
    const exportCard = page.locator('.export-card')
    await expect(exportCard).toBeVisible()
    await expect(exportCard.locator('.badge--pending_confirmation')).toBeVisible()

    // Confirm the export
    await exportCard.locator('button:has-text("Confirm export")').click()

    // Export should now be confirmed
    await expect(exportCard.locator('.badge--confirmed')).toBeVisible()

    // Pending count should update to 0
    await expect(page.locator('#export-summary')).toContainText('0 pending words')

    // Export button should not be visible (no pending words)
    await expect(page.locator('#export-btn')).not.toBeVisible()
  })
})
