import { describe, it, expect, beforeEach, afterAll } from 'vitest'
import { SupabaseWordRepository } from './SupabaseWordRepository'
import { SupabaseDeckRepository } from './SupabaseDeckRepository'
import { Word } from '../../domain/entities/Word'
import { Deck } from '../../domain/entities/Deck'
import { Language } from '../../domain/values/Language'
import { WordStatus } from '../../domain/values/WordStatus'
import { createTestClient, cleanupTestData, TEST_USER_ID } from './testClient'

const client = createTestClient()
const wordRepo = new SupabaseWordRepository(client)
const deckRepo = new SupabaseDeckRepository(client)

let enDeckId: string
let frDeckId: string

async function createTestDecks() {
  enDeckId = crypto.randomUUID()
  frDeckId = crypto.randomUUID()
  await deckRepo.save(Deck.create({ id: enDeckId, userId: TEST_USER_ID, name: 'English::Basics', language: Language.EN }))
  await deckRepo.save(Deck.create({ id: frDeckId, userId: TEST_USER_ID, name: 'French::Basics', language: Language.FR }))
}

function makeWord(overrides: Partial<{ id: string; word: string; status: WordStatus; deckId: string }> = {}): Word {
  return Word.create({
    id: overrides.id ?? crypto.randomUUID(),
    userId: TEST_USER_ID,
    word: overrides.word ?? 'hello',
    language: Language.EN,
    translations: ['hallo'],
    sentencesSource: ['Hello, how are you?'],
    sentencesGerman: ['Hallo, wie geht es dir?'],
    deckId: overrides.deckId ?? enDeckId,
    status: overrides.status ?? WordStatus.Pending,
    createdAt: new Date('2026-03-25'),
    exportedAt: null,
  })
}

describe('SupabaseWordRepository', () => {
  beforeEach(async () => {
    await cleanupTestData(client)
    await createTestDecks()
  })

  afterAll(async () => {
    await cleanupTestData(client)
  })

  it('saves and retrieves a word by id', async () => {
    const word = makeWord()
    await wordRepo.save(word)

    const found = await wordRepo.findById(word.id, TEST_USER_ID)

    expect(found).not.toBeNull()
    expect(found!.id).toBe(word.id)
    expect(found!.word).toBe('hello')
    expect(found!.language).toBe(Language.EN)
    expect(found!.translations).toEqual(['hallo'])
    expect(found!.deckId).toBe(enDeckId)
    expect(found!.status).toBe(WordStatus.Pending)
  })

  it('returns null for non-existent word', async () => {
    const found = await wordRepo.findById(crypto.randomUUID(), TEST_USER_ID)
    expect(found).toBeNull()
  })

  it('finds all words by user', async () => {
    await wordRepo.save(makeWord({ word: 'hello' }))
    await wordRepo.save(makeWord({ word: 'goodbye' }))

    const words = await wordRepo.findAllByUser(TEST_USER_ID)
    expect(words).toHaveLength(2)
  })

  it('finds words by deck id', async () => {
    await wordRepo.save(makeWord({ word: 'hello', deckId: enDeckId }))
    await wordRepo.save(makeWord({ word: 'bonjour', deckId: frDeckId }))

    const words = await wordRepo.findByDeckId(enDeckId, TEST_USER_ID)
    expect(words).toHaveLength(1)
    expect(words[0].word).toBe('hello')
  })

  it('finds only pending words by deck id', async () => {
    await wordRepo.save(makeWord({ word: 'hello', status: WordStatus.Pending }))
    await wordRepo.save(makeWord({ word: 'goodbye', status: WordStatus.Exported }))

    const words = await wordRepo.findPendingByDeckId(enDeckId, TEST_USER_ID)
    expect(words).toHaveLength(1)
    expect(words[0].word).toBe('hello')
  })

  it('updates a word', async () => {
    const word = makeWord()
    await wordRepo.save(word)

    const exported = word.markExported(new Date('2026-03-26'))
    await wordRepo.update(exported)

    const found = await wordRepo.findById(word.id, TEST_USER_ID)
    expect(found!.status).toBe(WordStatus.Exported)
    expect(found!.exportedAt).toEqual(new Date('2026-03-26'))
  })

  it('deletes a word', async () => {
    const word = makeWord()
    await wordRepo.save(word)
    await wordRepo.delete(word.id, TEST_USER_ID)

    const found = await wordRepo.findById(word.id, TEST_USER_ID)
    expect(found).toBeNull()
  })

  it('findPaginated returns paginated results with total count', async () => {
    for (let i = 0; i < 5; i++) {
      await wordRepo.save(makeWord({ word: `word-${i}` }))
    }

    const page1 = await wordRepo.findPaginated(TEST_USER_ID, { offset: 0, limit: 2 })
    expect(page1.words).toHaveLength(2)
    expect(page1.total).toBe(5)
    expect(page1.hasMore).toBe(true)

    const page2 = await wordRepo.findPaginated(TEST_USER_ID, { offset: 2, limit: 2 })
    expect(page2.words).toHaveLength(2)
    expect(page2.hasMore).toBe(true)

    const page3 = await wordRepo.findPaginated(TEST_USER_ID, { offset: 4, limit: 2 })
    expect(page3.words).toHaveLength(1)
    expect(page3.hasMore).toBe(false)
  })

  it('findPaginated filters by deck', async () => {
    await wordRepo.save(makeWord({ word: 'hello', deckId: enDeckId }))
    await wordRepo.save(makeWord({ word: 'bonjour', deckId: frDeckId }))

    const result = await wordRepo.findPaginated(TEST_USER_ID, { deckId: enDeckId, offset: 0, limit: 10 })
    expect(result.words).toHaveLength(1)
    expect(result.words[0].word).toBe('hello')
    expect(result.total).toBe(1)
  })

  it('findPaginated filters by status', async () => {
    await wordRepo.save(makeWord({ word: 'pending-word', status: WordStatus.Pending }))
    await wordRepo.save(makeWord({ word: 'exported-word', status: WordStatus.Exported }))

    const result = await wordRepo.findPaginated(TEST_USER_ID, { status: WordStatus.Pending, offset: 0, limit: 10 })
    expect(result.words).toHaveLength(1)
    expect(result.words[0].word).toBe('pending-word')
  })

  it('findPaginated searches by word text', async () => {
    await wordRepo.save(makeWord({ word: 'hello' }))
    await wordRepo.save(makeWord({ word: 'goodbye' }))
    await wordRepo.save(makeWord({ word: 'help' }))

    const result = await wordRepo.findPaginated(TEST_USER_ID, { search: 'hel', offset: 0, limit: 10 })
    expect(result.words).toHaveLength(2)
    expect(result.total).toBe(2)
    const words = result.words.map((w) => w.word).sort()
    expect(words).toEqual(['hello', 'help'])
  })

  it('findPaginated with searchSentences searches across all fields', async () => {
    await wordRepo.save(makeWord({ word: 'hello' }))
    await wordRepo.save(makeWord({ word: 'goodbye' }))

    // Search for a term in the German sentences (both have 'Hallo' in sentencesGerman)
    const result = await wordRepo.findPaginated(TEST_USER_ID, {
      search: 'Hallo',
      searchSentences: true,
      offset: 0,
      limit: 10,
    })
    // Both words have 'Hallo' in their German sentences
    expect(result.words).toHaveLength(2)
  })

  it('markExportedBatch updates multiple words in a single operation', async () => {
    const w1 = makeWord({ word: 'hello' })
    const w2 = makeWord({ word: 'goodbye' })
    const w3 = makeWord({ word: 'thanks' })
    await wordRepo.save(w1)
    await wordRepo.save(w2)
    await wordRepo.save(w3)

    // Batch-mark only w1 and w2 as exported
    const exportedAt = new Date('2026-03-29')
    await wordRepo.markExportedBatch([w1.id, w2.id], TEST_USER_ID, exportedAt)

    const found1 = await wordRepo.findById(w1.id, TEST_USER_ID)
    expect(found1!.status).toBe(WordStatus.Exported)
    expect(found1!.exportedAt).toEqual(exportedAt)

    const found2 = await wordRepo.findById(w2.id, TEST_USER_ID)
    expect(found2!.status).toBe(WordStatus.Exported)
    expect(found2!.exportedAt).toEqual(exportedAt)

    // w3 should remain pending
    const found3 = await wordRepo.findById(w3.id, TEST_USER_ID)
    expect(found3!.status).toBe(WordStatus.Pending)
    expect(found3!.exportedAt).toBeNull()
  })

  it('cascade deletes words when deck is deleted', async () => {
    await wordRepo.save(makeWord({ word: 'hello', deckId: enDeckId }))
    await wordRepo.save(makeWord({ word: 'world', deckId: enDeckId }))

    // Delete the deck
    await deckRepo.delete(enDeckId, TEST_USER_ID)

    // Words should be gone
    const words = await wordRepo.findAllByUser(TEST_USER_ID)
    expect(words).toHaveLength(0)
  })
})
