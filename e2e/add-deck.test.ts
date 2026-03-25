import { test, expect } from '@playwright/test'

test('create a new deck and verify it is selected in the dropdown', async ({ page }) => {
  await page.goto('/')

  // Should be on the Add Word page (authenticated via storage state)
  await expect(page.locator('#app-title')).toContainText('Vocab')

  // Select EN language
  await page.click('#lang-en')

  // Open deck selector and choose "New deck"
  await page.selectOption('#deck-select', '__new__')

  // Type deck name and create
  const deckInput = page.locator('#new-deck-input')
  await expect(deckInput).toBeVisible()
  await expect(deckInput).toHaveAttribute(
    'placeholder',
    'e.g. English::Vocabulary or French::Verbs',
  )
  await deckInput.fill('English::TestDeck')
  await page.click('#create-deck-btn')

  // Verify the new deck is now selected in the dropdown
  await expect(page.locator('#deck-select')).toHaveValue('English::TestDeck')

  // Verify the create form is hidden
  await expect(deckInput).not.toBeVisible()
})
