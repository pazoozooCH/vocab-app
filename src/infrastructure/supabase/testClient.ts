import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const SUPABASE_LOCAL_URL = 'http://127.0.0.1:54321'

function getSecretKey(): string {
  const key = process.env.SUPABASE_SECRET_KEY
  if (!key) throw new Error('SUPABASE_SECRET_KEY env var is required for tests')
  return key
}

export const TEST_USER_ID = '00000000-0000-0000-0000-000000000099'

export function createTestClient(): SupabaseClient {
  return createClient(SUPABASE_LOCAL_URL, getSecretKey())
}

export async function ensureTestUser(client: SupabaseClient): Promise<void> {
  const { data } = await client.auth.admin.getUserById(TEST_USER_ID)
  if (data.user) return

  const { error } = await client.auth.admin.createUser({
    user_metadata: { name: 'Test User' },
    email: 'test@test.local',
    email_confirm: true,
    id: TEST_USER_ID,
  })
  if (error) throw error
}

export async function cleanupTestData(client: SupabaseClient): Promise<void> {
  await client.from('words').delete().eq('user_id', TEST_USER_ID)
  await client.from('decks').delete().eq('user_id', TEST_USER_ID)
}
