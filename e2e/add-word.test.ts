import { test, expect } from '@playwright/test'

const mockTranslation = {
  translations: ['hallo'],
  sentencesSource: [
    '1. **Hello**, how are you?',
    '2. She said **hello** to everyone.',
  ],
  sentencesGerman: [
    '1. **Hallo**, wie geht es dir?',
    '2. Sie sagte **hallo** zu allen.',
  ],
}

function mockTranslateApi(page: import('@playwright/test').Page) {
  return page.route('**/api/translate', async (route) => {
    const request = route.request()
    const body = request.postDataJSON()

    if (!body.word || !body.language) {
      return route.fulfill({ status: 400, contentType: 'application/json', body: '{"error":"Invalid request"}' })
    }

    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(mockTranslation),
    })
  })
}

test.describe('Add Word flow', () => {
  test('add an English word and see the translation result', async ({ page }) => {
    await mockTranslateApi(page)
    await page.goto('/')

    // Select EN language (default, but be explicit)
    await page.click('.language-toggle__btn:has-text("EN")')

    // Create a deck first
    await page.selectOption('.deck-selector__select', '__new__')
    await page.locator('.deck-selector__input').fill('English::Test')
    await page.click('.deck-selector__create .btn:has-text("Create")')

    // Type a word and submit
    await page.locator('.add-word-form__input').fill('hello')
    await page.click('.btn--primary:has-text("Add Word")')

    // Verify the translation result appears
    const result = page.locator('.add-word-result')
    await expect(result).toBeVisible()
    await expect(result.locator('.word-card__word')).toHaveText('hello')
    await expect(result.locator('.word-card__translations')).toHaveText('hallo')
    await expect(result.locator('.badge--en')).toHaveText('EN')
    await expect(result.locator('.badge--pending')).toHaveText('pending')

    // Verify sentences are displayed
    const sentences = result.locator('.word-card__sentence')
    await expect(sentences).toHaveCount(4)

    // Verify the input is cleared for the next word
    await expect(page.locator('.add-word-form__input')).toHaveValue('')
  })

  test('add a French word with article', async ({ page }) => {
    const frenchMock = {
      translations: ['der Hund'],
      sentencesSource: [
        '1. **Un chien** court dans le parc.',
        '2. Elle a **un chien** adorable.',
      ],
      sentencesGerman: [
        '1. **Ein Hund** läuft im Park.',
        '2. Sie hat **einen Hund**, der süß ist.',
      ],
    }

    await page.route('**/api/translate', async (route) => {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(frenchMock),
      })
    })

    await page.goto('/')

    // Switch to French
    await page.click('.language-toggle__btn:has-text("FR")')

    // Create a French deck
    await page.selectOption('.deck-selector__select', '__new__')
    await page.locator('.deck-selector__input').fill('French::Test')
    await page.click('.deck-selector__create .btn:has-text("Create")')

    // Type a word and submit
    await page.locator('.add-word-form__input').fill('un chien')
    await page.click('.btn--primary:has-text("Add Word")')

    // Verify result
    const result = page.locator('.add-word-result')
    await expect(result).toBeVisible()
    await expect(result.locator('.word-card__word')).toHaveText('un chien')
    await expect(result.locator('.badge--fr')).toHaveText('FR')
    await expect(result.locator('.word-card__translations')).toHaveText('der Hund')
  })

  test('show error when translation fails', async ({ page }) => {
    await page.route('**/api/translate', async (route) => {
      return route.fulfill({
        status: 503,
        contentType: 'application/json',
        body: '{"error":"Translation service is temporarily busy. Please try again in a moment."}',
      })
    })

    await page.goto('/')
    await page.click('.language-toggle__btn:has-text("EN")')

    // Create a deck
    await page.selectOption('.deck-selector__select', '__new__')
    await page.locator('.deck-selector__input').fill('English::Errors')
    await page.click('.deck-selector__create .btn:has-text("Create")')

    // Type a word and submit
    await page.locator('.add-word-form__input').fill('test')
    await page.click('.btn--primary:has-text("Add Word")')

    // Verify error message is shown
    await expect(page.locator('.error-message')).toContainText('temporarily busy')
  })

  test('added word appears in the word list', async ({ page }) => {
    await mockTranslateApi(page)
    await page.goto('/')

    // Create deck and add a word
    await page.click('.language-toggle__btn:has-text("EN")')
    await page.selectOption('.deck-selector__select', '__new__')
    await page.locator('.deck-selector__input').fill('English::ListTest')
    await page.click('.deck-selector__create .btn:has-text("Create")')
    await page.locator('.add-word-form__input').fill('hello')
    await page.click('.btn--primary:has-text("Add Word")')
    await expect(page.locator('.add-word-result')).toBeVisible()

    // Navigate to word list
    await page.click('.bottom-nav__tab:has-text("Words")')

    // Verify the word appears
    await expect(page.locator('.word-card__word').first()).toHaveText('hello')
  })
})
