import { test, expect } from '@playwright/test'
import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'http://127.0.0.1:54321'
const E2E_USER_ID = '00000000-0000-0000-0000-000000000088'

test.beforeEach(async () => {
  const client = createClient(SUPABASE_URL, process.env.SUPABASE_SECRET_KEY ?? '')
  await client.from('words').delete().eq('user_id', E2E_USER_ID)
  await client.from('decks').delete().eq('user_id', E2E_USER_ID)
})

test('empty word list shows "No words found" instead of loading', async ({ page }) => {
  await page.goto('/words')

  // Should show empty state, not loading
  await expect(page.locator('#empty-state')).toHaveText('No words found.')
  await expect(page.locator('.loading-text')).not.toBeVisible()
})
