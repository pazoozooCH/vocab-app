import { test, expect } from '@playwright/test'
import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'http://127.0.0.1:54321'
const E2E_USER_ID = '00000000-0000-0000-0000-000000000088'

const mockTranslation = {
  word: 'duplicatetest',
  translations: ['Duplikattest'],
  sentencesSource: ['1. This is a **duplicatetest** sentence.'],
  sentencesGerman: ['1. Dies ist ein **Duplikattest**-Satz.'],
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

test.beforeEach(async () => {
  // Clean up e2e user data before each test to avoid cross-test interference
  const client = createClient(SUPABASE_URL, process.env.SUPABASE_SECRET_KEY ?? '')
  await client.from('words').delete().eq('user_id', E2E_USER_ID)
  await client.from('decks').delete().eq('user_id', E2E_USER_ID)
})

test('shows potential duplicates when adding a word that already exists', async ({ page }) => {
  await mockTranslateApi(page)
  await page.goto('/')

  await page.click('#lang-en')
  await page.selectOption('#deck-select', '__new__')
  await page.locator('#new-deck-input').fill('English::Dupes')
  await page.click('#create-deck-btn')

  // Add the word the first time
  await page.locator('#word-input').fill('duplicatetest')
  await page.click('#add-word-btn')
  await expect(page.locator('#add-word-result')).toBeVisible()

  // No duplicates on first add
  await expect(page.locator('.btn--warn')).not.toBeVisible()

  // Add the same word again
  await page.locator('#word-input').fill('duplicatetest')
  await page.click('#add-word-btn')
  await expect(page.locator('#add-word-result')).toBeVisible()

  // Should show duplicate warning
  const dupeBtn = page.locator('.btn--warn')
  await expect(dupeBtn).toBeVisible()
  await expect(dupeBtn).toContainText('1 potential duplicate')

  // Click to reveal duplicates
  await dupeBtn.click()
  const dupeSection = page.locator('.word-card__duplicates')
  await expect(dupeSection).toBeVisible()
  await expect(dupeSection.locator('.word-card__duplicate-word')).toContainText('duplicatetest')

  // Click again to hide
  await dupeBtn.click()
  await expect(dupeSection).not.toBeVisible()
})
