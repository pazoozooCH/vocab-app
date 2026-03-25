import { test, expect } from './fixtures'

const mockTranslation = {
  word: 'hello',
  translations: ['hallo'],
  sentencesSource: ['1. **Hello**, how are you?'],
  sentencesGerman: ['1. **Hallo**, wie geht es dir?'],
}

test('cannot create a duplicate deck', async ({ page }) => {
  await page.goto('/')
  await page.click('#lang-en')

  // Create first deck
  await page.selectOption('#deck-select', '__new__')
  await page.locator('#new-deck-input').fill('English::Unique')
  await page.click('#create-deck-btn')
  await expect(page.locator('#deck-select')).toHaveValue('English::Unique')

  // Try to create the same deck again
  await page.selectOption('#deck-select', '__new__')
  await page.locator('#new-deck-input').fill('English::Unique')
  await page.click('#create-deck-btn')

  // Should show error
  await expect(page.locator('#deck-create-error')).toContainText('already exists')

  // Original deck should still be there
  await page.click('#cancel-deck-btn')
  await expect(page.locator('#deck-select')).toHaveValue('English::Unique')
})

test('delete an empty deck', async ({ page }) => {
  await page.goto('/')
  await page.click('#lang-en')

  // Create a deck
  await page.selectOption('#deck-select', '__new__')
  await page.locator('#new-deck-input').fill('English::ToDelete')
  await page.click('#create-deck-btn')
  await expect(page.locator('#deck-select')).toHaveValue('English::ToDelete')

  // Delete it — no confirmation needed since it's empty
  await page.click('#delete-deck-btn')

  // Deck should be gone, selector reset
  await expect(page.locator('#deck-select')).not.toHaveValue('English::ToDelete')
})

test('delete a deck with words asks for confirmation', async ({ page }) => {
  await page.route('**/api/translate', async (route) => {
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(mockTranslation),
    })
  })

  await page.goto('/')
  await page.click('#lang-en')

  // Create a deck and add a word
  await page.selectOption('#deck-select', '__new__')
  await page.locator('#new-deck-input').fill('English::WithWords')
  await page.click('#create-deck-btn')
  await page.locator('#word-input').fill('hello')
  await page.click('#add-word-btn')
  await expect(page.locator('#add-word-result')).toBeVisible()

  // Accept the confirmation dialog
  page.on('dialog', async (dialog) => {
    expect(dialog.message()).toContain('1 word')
    await dialog.accept()
  })

  // Delete the deck
  await page.click('#delete-deck-btn')

  // Deck and its words should be gone
  await expect(page.locator('#deck-select')).not.toHaveValue('English::WithWords')
})
