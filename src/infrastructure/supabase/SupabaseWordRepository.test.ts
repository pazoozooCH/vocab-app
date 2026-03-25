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
