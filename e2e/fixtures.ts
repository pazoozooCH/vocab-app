/* eslint-disable react-hooks/rules-of-hooks -- Playwright fixture, not a React hook */
import { test as base } from '@playwright/test'
import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'http://127.0.0.1:54321'
const E2E_USER_ID = '00000000-0000-0000-0000-000000000088'

// Extend the base test to clean up DB before each test
export const test = base.extend({
  page: async ({ page }, use) => {
    const client = createClient(SUPABASE_URL, process.env.SUPABASE_SECRET_KEY ?? '')
    await client.from('words').delete().eq('user_id', E2E_USER_ID)
    await client.from('decks').delete().eq('user_id', E2E_USER_ID)
    await use(page)
  },
})

export { expect } from '@playwright/test'
