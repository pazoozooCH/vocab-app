import { test, expect } from './fixtures'

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
    await page.click('#lang-en')

    // Create a deck first
    await page.selectOption('#deck-select', '__new__')
    await page.locator('#new-deck-input').fill('English::Test')
    await page.click('#create-deck-btn')

    // Type a word and submit
    await page.locator('#word-input').fill('hello')
    await page.click('#add-word-btn')

    // Verify the translation result appears
    const result = page.locator('#add-word-result')
    await expect(result).toBeVisible()
    await expect(result.locator('.word-card__word')).toHaveText('hello')
    await expect(result.locator('.word-card__translations')).toHaveText('hallo')
    await expect(result.locator('.badge--en')).toHaveText('EN')
    await expect(result.locator('.badge--pending')).toHaveText('pending')

    // Verify sentences are displayed
    const sentences = result.locator('.word-card__sentence')
    await expect(sentences).toHaveCount(4)

    // Verify the input is cleared for the next word
    await expect(page.locator('#word-input')).toHaveValue('')
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
    await page.click('#lang-fr')

    // Create a French deck
    await page.selectOption('#deck-select', '__new__')
    await page.locator('#new-deck-input').fill('French::Test')
    await page.click('#create-deck-btn')

    // Type a word and submit
    await page.locator('#word-input').fill('un chien')
    await page.click('#add-word-btn')

    // Verify result
    const result = page.locator('#add-word-result')
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
    await page.click('#lang-en')

    // Create a deck
    await page.selectOption('#deck-select', '__new__')
    await page.locator('#new-deck-input').fill('English::Errors')
    await page.click('#create-deck-btn')

    // Type a word and submit
    await page.locator('#word-input').fill('test')
    await page.click('#add-word-btn')

    // Verify error message is shown
    await expect(page.locator('#error-message')).toContainText('temporarily busy')
  })

  test('refine a word with context adds classifier to source word', async ({ page }) => {
    // First request: generic translation without classifier
    let requestCount = 0
    await page.route('**/api/translate', async (route) => {
      requestCount++
      if (requestCount === 1) {
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            word: 'battery',
            translations: ['Batterie', 'Akku', 'Körperverletzung _[Law]_'],
            sentencesSource: ['1. The **battery** is low.'],
            sentencesGerman: ['1. Die **Batterie** ist leer.'],
          }),
        })
      }
      // Second request: refined with legal context
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          word: 'battery _[Law]_',
          translations: ['Körperverletzung _[Law]_'],
          sentencesSource: ['1. He was charged with **battery**.'],
          sentencesGerman: ['1. Er wurde wegen **Körperverletzung** angeklagt.'],
        }),
      })
    })

    await page.goto('/')
    await page.click('#lang-en')
    await page.selectOption('#deck-select', '__new__')
    await page.locator('#new-deck-input').fill('English::Refine')
    await page.click('#create-deck-btn')

    // Add the word
    await page.locator('#word-input').fill('battery')
    await page.click('#add-word-btn')
    const result = page.locator('#add-word-result')
    await expect(result).toBeVisible()

    // Word should show without classifier initially
    await expect(result.locator('.word-card__word')).toHaveText('battery')

    // Click refine and add context
    await page.click('#refine-btn')
    await page.locator('#refine-context-input').fill('legal')
    await page.click('#refine-submit-btn')

    // After refinement, word should show with classifier
    await expect(result.locator('.word-card__word')).toContainText('battery')
    await expect(result.locator('.word-card__word em')).toHaveText('[Law]')

    // Translation should also have the classifier
    await expect(result.locator('.word-card__translations')).toContainText('Körperverletzung')
    await expect(result.locator('.word-card__translations em')).toHaveText('[Law]')
  })

  test('added word appears in the word list', async ({ page }) => {
    await mockTranslateApi(page)
    await page.goto('/')

    // Create deck and add a word
    await page.click('#lang-en')
    await page.selectOption('#deck-select', '__new__')
    await page.locator('#new-deck-input').fill('English::ListTest')
    await page.click('#create-deck-btn')
    await page.locator('#word-input').fill('hello')
    await page.click('#add-word-btn')
    await expect(page.locator('#add-word-result')).toBeVisible()

    // Accept navigation guard and go to word list
    page.on('dialog', (dialog) => dialog.accept())
    await page.click('#nav-words')

    // Verify the word appears in compact row view
    await expect(page.locator('.word-row__word').first()).toHaveText('hello')
  })

  test('delete a word from the add page result', async ({ page }) => {
    await mockTranslateApi(page)
    await page.goto('/')

    await page.click('#lang-en')
    await page.selectOption('#deck-select', '__new__')
    await page.locator('#new-deck-input').fill('English::DeleteTest')
    await page.click('#create-deck-btn')
    await page.locator('#word-input').fill('hello')
    await page.click('#add-word-btn')
    await expect(page.locator('#add-word-result')).toBeVisible()
    await expect(page.locator('.word-card__word')).toHaveText('hello')

    // Accept the confirm dialog
    page.on('dialog', (dialog) => dialog.accept())

    // Delete the word
    await page.click('#add-word-result .btn--danger')

    // Word card should disappear from the result
    await expect(page.locator('#add-word-result .word-card')).not.toBeVisible()
  })

  test('delete a word from the word list', async ({ page }) => {
    await mockTranslateApi(page)
    await page.goto('/')

    // Add a word first
    await page.click('#lang-en')
    await page.selectOption('#deck-select', '__new__')
    await page.locator('#new-deck-input').fill('English::DeleteList')
    await page.click('#create-deck-btn')
    await page.locator('#word-input').fill('hello')
    await page.click('#add-word-btn')
    await expect(page.locator('#add-word-result')).toBeVisible()

    // Accept navigation guard and go to word list
    page.on('dialog', (dialog) => dialog.accept())
    await page.click('#nav-words')

    // Word should appear as a compact row
    const wordRow = page.locator('.expandable-word-row--collapsed').filter({ hasText: 'hello' })
    await expect(wordRow).toBeVisible()

    // Expand it to reveal the full card with delete button
    await wordRow.click()
    const wordCard = page.locator('.word-card').filter({ hasText: 'English::DeleteList' })
    await expect(wordCard).toBeVisible()

    // Delete from word list (dialog handler already registered above)
    await wordCard.locator('.btn--danger').click()

    // The row should be gone
    await expect(wordRow).not.toBeVisible()
  })
})
