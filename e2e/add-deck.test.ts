import { test, expect } from './fixtures'
import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'http://127.0.0.1:54321'
const E2E_USER_ID = '00000000-0000-0000-0000-000000000088'

test('create a new deck and verify it is selected and persisted in the DB', async ({ page }) => {
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
  await deckInput.fill('English::TestDeck')
  await page.click('#create-deck-btn')

  // Verify the new deck is now selected in the dropdown (value is a UUID now)
  await expect(page.locator('#deck-select option:checked')).toHaveText('English::TestDeck')

  // Verify the create form is hidden
  await expect(deckInput).not.toBeVisible()

  // Verify the deck actually exists in the database
  const client = createClient(SUPABASE_URL, process.env.SUPABASE_SECRET_KEY ?? '')
  const { data: decks, error } = await client
    .from('decks')
    .select()
    .eq('user_id', E2E_USER_ID)
    .eq('name', 'English::TestDeck')
    .eq('language', 'EN')

  expect(error).toBeNull()
  expect(decks).toHaveLength(1)
  expect(decks![0].name).toBe('English::TestDeck')
  expect(decks![0].language).toBe('EN')

  // Verify the selected dropdown value matches the DB id
  const selectedValue = await page.locator('#deck-select').inputValue()
  expect(selectedValue).toBe(decks![0].id)
})
