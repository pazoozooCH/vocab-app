import { test as setup } from '@playwright/test'
import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'http://127.0.0.1:54321'
const SUPABASE_SECRET_KEY = '***REDACTED_SUPABASE_SECRET***'
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY ?? ''
const E2E_USER_ID = '00000000-0000-0000-0000-000000000088'
const E2E_USER_EMAIL = 'e2e@test.local'
const E2E_USER_PASSWORD = 'e2e-test-password'

setup('authenticate', async ({ page }) => {
  const adminClient = createClient(SUPABASE_URL, SUPABASE_SECRET_KEY)

  // Ensure e2e user exists
  const { data: existing } = await adminClient.auth.admin.getUserById(E2E_USER_ID)
  if (!existing.user) {
    const { error } = await adminClient.auth.admin.createUser({
      id: E2E_USER_ID,
      email: E2E_USER_EMAIL,
      password: E2E_USER_PASSWORD,
      email_confirm: true,
      user_metadata: { name: 'E2E Test User' },
    })
    if (error) throw error
  }

  // Clean up any leftover e2e data
  await adminClient.from('words').delete().eq('user_id', E2E_USER_ID)
  await adminClient.from('decks').delete().eq('user_id', E2E_USER_ID)

  // Sign in server-side to get session tokens
  const anonClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
  const { data: signInData, error: signInError } =
    await anonClient.auth.signInWithPassword({
      email: E2E_USER_EMAIL,
      password: E2E_USER_PASSWORD,
    })
  if (signInError) throw signInError

  const session = signInData.session

  // Navigate to the app and inject the session into localStorage
  await page.goto('/')

  const storageKey = `sb-127-auth-token`
  await page.evaluate(
    ({ key, value }) => {
      localStorage.setItem(key, value)
    },
    {
      key: storageKey,
      value: JSON.stringify({
        access_token: session.access_token,
        refresh_token: session.refresh_token,
        expires_at: session.expires_at,
        expires_in: session.expires_in,
        token_type: session.token_type,
        user: session.user,
      }),
    },
  )

  // Reload so the app picks up the session from localStorage
  await page.goto('/')
  await page.waitForSelector('.top-bar__title')

  await page.context().storageState({ path: 'e2e/.auth/storage-state.json' })
})
