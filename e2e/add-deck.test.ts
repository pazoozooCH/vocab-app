import { test, expect } from '@playwright/test'

test('create a new deck and verify it is selected in the dropdown', async ({ page }) => {
  await page.goto('/')

  // Should be on the Add Word page (authenticated via storage state)
  await expect(page.locator('.top-bar__title')).toHaveText('Vocab')

  // Select EN language
  await page.click('.language-toggle__btn:has-text("EN")')

  // Open deck selector and choose "New deck"
  await page.selectOption('.deck-selector__select', '__new__')

  // Type deck name and create
  const deckInput = page.locator('.deck-selector__input')
  await expect(deckInput).toBeVisible()
  await expect(deckInput).toHaveAttribute(
    'placeholder',
    'e.g. English::Vocabulary or French::Verbs',
  )
  await deckInput.fill('English::TestDeck')
  await page.click('.deck-selector__create .btn:has-text("Create")')

  // Verify the new deck is now selected in the dropdown
  const select = page.locator('.deck-selector__select')
  await expect(select).toHaveValue('English::TestDeck')

  // Verify the create form is hidden
  await expect(deckInput).not.toBeVisible()
})
