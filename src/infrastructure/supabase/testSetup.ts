import dotenv from 'dotenv'
import { createTestClient, ensureTestUser } from './testClient'

export async function setup() {
  dotenv.config()

  const client = createTestClient()
  await ensureTestUser(client)
}
