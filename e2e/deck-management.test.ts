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
  await expect(page.locator('#deck-select option:checked')).toHaveText('English::Unique')

  // Try to create the same deck again
  await page.selectOption('#deck-select', '__new__')
  await page.locator('#new-deck-input').fill('English::Unique')
  await page.click('#create-deck-btn')

  // Should show error
  await expect(page.locator('#deck-create-error')).toContainText('already exists')

  // Original deck should still be there
  await page.click('#cancel-deck-btn')
  await expect(page.locator('#deck-select option:checked')).toHaveText('English::Unique')
})

test('delete an empty deck', async ({ page }) => {
  await page.goto('/')
  await page.click('#lang-en')

  // Create a deck
  await page.selectOption('#deck-select', '__new__')
  await page.locator('#new-deck-input').fill('English::ToDelete')
  await page.click('#create-deck-btn')
  await expect(page.locator('#deck-select option:checked')).toHaveText('English::ToDelete')

  // Delete it — no confirmation needed since it's empty
  await page.click('#delete-deck-btn')

  // Deck should be gone, selector reset
  await expect(page.locator('#deck-select option:checked')).not.toHaveText('English::ToDelete')
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
  await expect(page.locator('#deck-select option:checked')).not.toHaveText('English::WithWords')
})

test('rename a deck', async ({ page }) => {
  await page.goto('/')
  await page.click('#lang-en')

  // Create a deck
  await page.selectOption('#deck-select', '__new__')
  await page.locator('#new-deck-input').fill('English::OldName')
  await page.click('#create-deck-btn')
  await expect(page.locator('#deck-select option:checked')).toHaveText('English::OldName')

  // Click edit button
  await page.click('#edit-deck-btn')

  // Edit input should appear with current name
  const editInput = page.locator('#edit-deck-input')
  await expect(editInput).toBeVisible()
  await expect(editInput).toHaveValue('English::OldName')

  // Change the name and save
  await editInput.clear()
  await editInput.fill('English::NewName')
  await page.click('#save-deck-btn')

  // Edit form should close, dropdown should show new name
  await expect(editInput).not.toBeVisible()
  await expect(page.locator('#deck-select option:checked')).toHaveText('English::NewName')
})

test('rename to duplicate name shows error', async ({ page }) => {
  await page.goto('/')
  await page.click('#lang-en')

  // Create first deck
  await page.selectOption('#deck-select', '__new__')
  await page.locator('#new-deck-input').fill('English::First')
  await page.click('#create-deck-btn')
  await expect(page.locator('#deck-select option:checked')).toHaveText('English::First')

  // Create second deck
  await page.selectOption('#deck-select', '__new__')
  await expect(page.locator('#new-deck-input')).toBeVisible()
  await page.locator('#new-deck-input').fill('English::Second')
  await page.click('#create-deck-btn')
  await expect(page.locator('#deck-select option:checked')).toHaveText('English::Second')

  // Try to rename Second to First
  await page.click('#edit-deck-btn')
  const editInput = page.locator('#edit-deck-input')
  await editInput.clear()
  await editInput.fill('English::First')
  await page.click('#save-deck-btn')

  // Should show error
  await expect(page.locator('#deck-edit-error')).toContainText('already exists')
})
