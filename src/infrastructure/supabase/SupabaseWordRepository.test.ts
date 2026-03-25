import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest'
import { SupabaseWordRepository } from './SupabaseWordRepository'
import { Word } from '../../domain/entities/Word'
import { Language } from '../../domain/values/Language'
import { WordStatus } from '../../domain/values/WordStatus'
import { createTestClient, cleanupTestData, ensureTestUser, TEST_USER_ID } from './testClient'

const client = createTestClient()
const repo = new SupabaseWordRepository(client)

beforeAll(async () => {
  await ensureTestUser(client)
})

function makeWord(overrides: Partial<{ id: string; word: string; status: WordStatus; deck: string }> = {}): Word {
  return Word.create({
    id: overrides.id ?? crypto.randomUUID(),
    userId: TEST_USER_ID,
    word: overrides.word ?? 'hello',
    language: Language.EN,
    translations: ['hallo'],
    sentencesSource: ['Hello, how are you?'],
    sentencesGerman: ['Hallo, wie geht es dir?'],
    deck: overrides.deck ?? 'English::Basics',
    status: overrides.status ?? WordStatus.Pending,
    createdAt: new Date('2026-03-25'),
    exportedAt: null,
  })
}

describe('SupabaseWordRepository', () => {
  beforeEach(async () => {
    await cleanupTestData(client)
  })

  afterAll(async () => {
    await cleanupTestData(client)
  })

  it('saves and retrieves a word by id', async () => {
    const word = makeWord()
    await repo.save(word)

    const found = await repo.findById(word.id, TEST_USER_ID)

    expect(found).not.toBeNull()
    expect(found!.id).toBe(word.id)
    expect(found!.word).toBe('hello')
    expect(found!.language).toBe(Language.EN)
    expect(found!.translations).toEqual(['hallo'])
    expect(found!.sentencesSource).toEqual(['Hello, how are you?'])
    expect(found!.sentencesGerman).toEqual(['Hallo, wie geht es dir?'])
    expect(found!.deck).toBe('English::Basics')
    expect(found!.status).toBe(WordStatus.Pending)
  })

  it('returns null for non-existent word', async () => {
    const found = await repo.findById(crypto.randomUUID(), TEST_USER_ID)
    expect(found).toBeNull()
  })

  it('finds all words by user', async () => {
    await repo.save(makeWord({ word: 'hello' }))
    await repo.save(makeWord({ word: 'goodbye' }))

    const words = await repo.findAllByUser(TEST_USER_ID)
    expect(words).toHaveLength(2)
  })

  it('finds words by deck', async () => {
    await repo.save(makeWord({ word: 'hello', deck: 'English::Basics' }))
    await repo.save(makeWord({ word: 'bonjour', deck: 'French::Basics' }))

    const words = await repo.findByDeck('English::Basics', TEST_USER_ID)
    expect(words).toHaveLength(1)
    expect(words[0].word).toBe('hello')
  })

  it('finds only pending words by deck', async () => {
    await repo.save(makeWord({ word: 'hello', status: WordStatus.Pending }))
    await repo.save(makeWord({ word: 'goodbye', status: WordStatus.Exported }))

    const words = await repo.findPendingByDeck('English::Basics', TEST_USER_ID)
    expect(words).toHaveLength(1)
    expect(words[0].word).toBe('hello')
  })

  it('updates a word', async () => {
    const word = makeWord()
    await repo.save(word)

    const exported = word.markExported(new Date('2026-03-26'))
    await repo.update(exported)

    const found = await repo.findById(word.id, TEST_USER_ID)
    expect(found!.status).toBe(WordStatus.Exported)
    expect(found!.exportedAt).toEqual(new Date('2026-03-26'))
  })

  it('deletes a word', async () => {
    const word = makeWord()
    await repo.save(word)
    await repo.delete(word.id, TEST_USER_ID)

    const found = await repo.findById(word.id, TEST_USER_ID)
    expect(found).toBeNull()
  })
})
