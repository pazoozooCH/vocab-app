import { createTestClient, ensureTestUser } from './testClient'

export async function setup() {
  const client = createTestClient()
  await ensureTestUser(client)
}
