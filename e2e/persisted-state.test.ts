import { test, expect } from './fixtures'

const PERSISTED_KEYS = [
  'addWord.mode',
  'addWord.language',
  'addWord.deck',
  'wordList.deck',
]

test.beforeEach(async ({ page }) => {
  // Clear persisted preferences before each test
  await page.goto('/')
  await page.evaluate((keys) => {
    for (const key of keys) {
      localStorage.removeItem(key)
    }
  }, PERSISTED_KEYS)
})

test('persists language selection across navigation', async ({ page }) => {
  await page.goto('/')

  // Default is EN
  await expect(page.locator('#lang-en')).toHaveClass(/--active/)

  // Switch to FR
  await page.click('#lang-fr')
  await expect(page.locator('#lang-fr')).toHaveClass(/--active/)

  // Navigate away and back
  await page.click('#nav-words')
  await page.click('#nav-add')

  // FR should still be selected
  await expect(page.locator('#lang-fr')).toHaveClass(/--active/)
})

test('persists deck selection across navigation', async ({ page }) => {
  await page.goto('/')
  await page.click('#lang-en')

  // Create a deck
  await page.selectOption('#deck-select', '__new__')
  await page.locator('#new-deck-input').fill('English::Persist')
  await page.click('#create-deck-btn')
  await expect(page.locator('#deck-select option:checked')).toHaveText('English::Persist')

  // Navigate away and back
  await page.click('#nav-words')
  await page.click('#nav-add')

  // Deck should still be selected
  await expect(page.locator('#deck-select option:checked')).toHaveText('English::Persist')
})

test('persists batch mode across navigation', async ({ page }) => {
  await page.goto('/')

  // Switch to batch mode
  await page.click('#mode-batch')
  await expect(page.locator('#batch-input')).toBeVisible()

  // Navigate away and back
  await page.click('#nav-words')
  await page.click('#nav-add')

  // Should still be in batch mode
  await expect(page.locator('#batch-input')).toBeVisible()
})

test('persists word list deck filter across navigation', async ({ page }) => {
  // First create a deck via the add page
  await page.goto('/')
  await page.click('#lang-en')
  await page.selectOption('#deck-select', '__new__')
  await page.locator('#new-deck-input').fill('English::FilterTest')
  await page.click('#create-deck-btn')

  // Go to word list and select the deck filter (value is deck:<uuid> now)
  await page.click('#nav-words')
  const filterOption = page.locator('#deck-select option', { hasText: 'English::FilterTest' })
  const filterValue = await filterOption.getAttribute('value')
  await page.selectOption('#deck-select', filterValue!)
  await expect(page.locator('#deck-select option:checked')).toHaveText('English::FilterTest')

  // Navigate away and back
  await page.click('#nav-add')
  await page.click('#nav-words')

  // Filter should still be set
  await expect(page.locator('#deck-select option:checked')).toHaveText('English::FilterTest')
})
