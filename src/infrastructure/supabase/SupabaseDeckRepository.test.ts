import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest'
import { SupabaseDeckRepository } from './SupabaseDeckRepository'
import { Deck } from '../../domain/entities/Deck'
import { Language } from '../../domain/values/Language'
import { createTestClient, cleanupTestData, ensureTestUser, TEST_USER_ID } from './testClient'

const client = createTestClient()
const repo = new SupabaseDeckRepository(client)

beforeAll(async () => {
  await ensureTestUser(client)
})

function makeDeck(overrides: Partial<{ id: string; name: string; language: Language }> = {}): Deck {
  return Deck.create({
    id: overrides.id ?? crypto.randomUUID(),
    userId: TEST_USER_ID,
    name: overrides.name ?? 'English::Basics',
    language: overrides.language ?? Language.EN,
  })
}

describe('SupabaseDeckRepository', () => {
  beforeEach(async () => {
    await cleanupTestData(client)
  })

  afterAll(async () => {
    await cleanupTestData(client)
  })

  it('saves and retrieves a deck by id', async () => {
    const deck = makeDeck()
    await repo.save(deck)

    const found = await repo.findById(deck.id, TEST_USER_ID)

    expect(found).not.toBeNull()
    expect(found!.id).toBe(deck.id)
    expect(found!.name).toBe('English::Basics')
    expect(found!.language).toBe(Language.EN)
    expect(found!.userId).toBe(TEST_USER_ID)
  })

  it('returns null for non-existent deck', async () => {
    const found = await repo.findById(crypto.randomUUID(), TEST_USER_ID)
    expect(found).toBeNull()
  })

  it('finds all decks by user, ordered by name', async () => {
    await repo.save(makeDeck({ name: 'French::Basics', language: Language.FR }))
    await repo.save(makeDeck({ name: 'English::Basics', language: Language.EN }))

    const decks = await repo.findAllByUser(TEST_USER_ID)
    expect(decks).toHaveLength(2)
    expect(decks[0].name).toBe('English::Basics')
    expect(decks[1].name).toBe('French::Basics')
  })

  it('finds decks by language', async () => {
    await repo.save(makeDeck({ name: 'English::Basics', language: Language.EN }))
    await repo.save(makeDeck({ name: 'French::Basics', language: Language.FR }))

    const enDecks = await repo.findByLanguage(Language.EN, TEST_USER_ID)
    expect(enDecks).toHaveLength(1)
    expect(enDecks[0].name).toBe('English::Basics')

    const frDecks = await repo.findByLanguage(Language.FR, TEST_USER_ID)
    expect(frDecks).toHaveLength(1)
    expect(frDecks[0].name).toBe('French::Basics')
  })

  it('updates a deck', async () => {
    const deck = makeDeck()
    await repo.save(deck)

    const renamed = deck.rename('English::Advanced')
    await repo.update(renamed)

    const found = await repo.findById(deck.id, TEST_USER_ID)
    expect(found!.name).toBe('English::Advanced')
  })

  it('deletes a deck', async () => {
    const deck = makeDeck()
    await repo.save(deck)
    await repo.delete(deck.id, TEST_USER_ID)

    const found = await repo.findById(deck.id, TEST_USER_ID)
    expect(found).toBeNull()
  })
})
