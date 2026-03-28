import { test, expect } from './fixtures'

const mockTranslation = (word: string, translation: string) => ({
  word,
  translations: [translation],
  sentencesSource: [`1. This is a **${word}** sentence.`],
  sentencesGerman: [`1. Das ist ein **${translation}**-Satz.`],
})

test.describe('Word list search and pagination', () => {
  test.beforeEach(async ({ page }) => {
    // Add several words via mocked API
    let callCount = 0
    const words = [
      mockTranslation('apple', 'der Apfel'),
      mockTranslation('banana', 'die Banane'),
      mockTranslation('cherry', 'die Kirsche'),
    ]

    await page.route('**/api/translate', async (route) => {
      const mock = words[callCount % words.length]
      callCount++
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(mock),
      })
    })

    await page.goto('/')
    await page.click('#lang-en')
    await page.selectOption('#deck-select', '__new__')
    await page.locator('#new-deck-input').fill('English::Search')
    await page.click('#create-deck-btn')

    // Add words one by one
    for (const w of words) {
      await page.locator('#word-input').fill(w.word)
      await page.click('#add-word-btn')
      await expect(page.locator('#add-word-result')).toBeVisible()
    }

    // Navigate to word list (accept nav guard)
    page.on('dialog', (dialog) => dialog.accept())
    await page.click('#nav-words')
    await expect(page.locator('.word-list__count')).toBeVisible()
  })

  test('search filters words by text', async ({ page }) => {
    // Should show all 3 words
    await expect(page.locator('.word-list__count')).toContainText('3 word')

    // Search for 'app' — should match 'apple'
    await page.locator('#search-input').fill('app')
    await expect(page.locator('.word-list__count')).toContainText('1 word')
    await expect(page.locator('.word-list__count')).toContainText('matching "app"')
    await expect(page.locator('.word-row__word')).toContainText('apple')
  })

  test('search with no results shows empty state', async ({ page }) => {
    await page.locator('#search-input').fill('zzzzz')
    await expect(page.locator('#empty-state')).toContainText('No matching words found')
  })

  test('clearing search shows all words again', async ({ page }) => {
    await page.locator('#search-input').fill('banana')
    await expect(page.locator('.word-list__count')).toContainText('1 word')

    await page.locator('#search-input').clear()
    await expect(page.locator('.word-list__count')).toContainText('3 word')
  })
})
