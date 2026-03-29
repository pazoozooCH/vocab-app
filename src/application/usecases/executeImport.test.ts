import { describe, it, expect, vi } from 'vitest'
import { executeImport } from './executeImport'
import type { WordRepository } from '../ports/WordRepository'
import type { DeckRepository } from '../ports/DeckRepository'
import type { CategorizedNote } from './analyzeImport'
import type { ParsedNote } from '../../infrastructure/anki/parseApkg'
import { Word } from '../../domain/entities/Word'
import { Deck } from '../../domain/entities/Deck'
import { Language } from '../../domain/values/Language'
import { WordStatus } from '../../domain/values/WordStatus'

const USER_ID = 'user-123'

function makeNote(overrides: Partial<ParsedNote> = {}): ParsedNote {
  return {
    guid: overrides.guid ?? 'note-1',
    word: overrides.word ?? 'hello',
    translations: overrides.translations ?? ['hallo'],
    sentencesSource: overrides.sentencesSource ?? [],
    sentencesGerman: overrides.sentencesGerman ?? [],
    language: overrides.language ?? Language.EN,
    deckName: overrides.deckName ?? 'English::Test',
    noteTypeName: overrides.noteTypeName ?? 'Basic',
    vocabId: overrides.vocabId ?? null,
  }
}

function makeWord(overrides: Partial<{ id: string; word: string; deckId: string; ankiGuid: string | null }> = {}): Word {
  return Word.create({
    id: overrides.id ?? 'word-1',
    userId: USER_ID,
    word: overrides.word ?? 'hello',
    language: Language.EN,
    translations: ['hallo'],
    sentencesSource: [],
    sentencesGerman: [],
    deckId: overrides.deckId ?? 'deck-en',
    status: WordStatus.Imported,
    createdAt: new Date('2026-03-25'),
    exportedAt: null,
    ankiGuid: overrides.ankiGuid ?? null,
  })
}

function createMockRepos(existingDecks: Deck[] = []): {
  wordRepository: WordRepository
  deckRepository: DeckRepository
} {
  return {
    wordRepository: {
      save: vi.fn(),
      saveBatch: vi.fn(),
      findById: vi.fn(),
      findByIds: vi.fn().mockResolvedValue([]),
      findByDeckId: vi.fn(),
      findPendingByDeckId: vi.fn(),
      findAllByUser: vi.fn(),
      findPaginated: vi.fn(),
      findDuplicates: vi.fn(),
      markExportedBatch: vi.fn(),
      update: vi.fn(),
      updateBatch: vi.fn(),
      delete: vi.fn(),
      findByAnkiGuids: vi.fn().mockResolvedValue([]),
    },
    deckRepository: {
      save: vi.fn(),
      findById: vi.fn(),
      findAllByUser: vi.fn().mockResolvedValue(existingDecks),
      findByLanguage: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
  }
}

describe('executeImport', () => {
  it('creates new decks from the hierarchy', async () => {
    const deps = createMockRepos()
    const categorized: CategorizedNote[] = [
      { note: makeNote({ deckName: 'English::Test' }), category: 'new' },
    ]

    await executeImport(categorized, ['English', 'English::Test'], USER_ID, deps)

    expect(deps.deckRepository.save).toHaveBeenCalledTimes(2)
    const saved = (deps.deckRepository.save as ReturnType<typeof vi.fn>).mock.calls
    expect(saved[0][0].name).toBe('English')
    expect(saved[1][0].name).toBe('English::Test')
  })

  it('inserts new words with status imported and anki_guid', async () => {
    const existingDecks = [Deck.create({ id: 'deck-en', name: 'English::Test', userId: USER_ID, language: Language.EN })]
    const deps = createMockRepos(existingDecks)
    const categorized: CategorizedNote[] = [
      { note: makeNote({ guid: 'g1', word: 'hello', deckName: 'English::Test' }), category: 'new' },
      { note: makeNote({ guid: 'g2', word: 'world', deckName: 'English::Test' }), category: 'new' },
    ]

    const result = await executeImport(categorized, [], USER_ID, deps)

    expect(result.added).toBe(2)
    expect(deps.wordRepository.saveBatch).toHaveBeenCalledTimes(1)
    const batch = (deps.wordRepository.saveBatch as ReturnType<typeof vi.fn>).mock.calls[0][0] as Word[]
    expect(batch).toHaveLength(2)
    expect(batch[0].status).toBe(WordStatus.Imported)
    expect(batch[0].ankiGuid).toBe('g1')
    expect(batch[1].ankiGuid).toBe('g2')
  })

  it('updates changed words preserving existing id and status', async () => {
    const existingWord = makeWord({ id: 'existing-1', word: 'old', deckId: 'deck-en', ankiGuid: 'g1' })
    const existingDecks = [Deck.create({ id: 'deck-en', name: 'English::Test', userId: USER_ID, language: Language.EN })]
    const deps = createMockRepos(existingDecks)
    const categorized: CategorizedNote[] = [
      {
        note: makeNote({ guid: 'g1', word: 'updated word', deckName: 'English::Test' }),
        category: 'updated',
        existingWord,
        changes: ['word'],
      },
    ]

    const result = await executeImport(categorized, [], USER_ID, deps)

    expect(result.updated).toBe(1)
    expect(deps.wordRepository.updateBatch).toHaveBeenCalledTimes(1)
    const updated = (deps.wordRepository.updateBatch as ReturnType<typeof vi.fn>).mock.calls[0][0] as Word[]
    expect(updated[0].id).toBe('existing-1')
    expect(updated[0].word).toBe('updated word')
    expect(updated[0].status).toBe(WordStatus.Imported) // preserves existing status
  })

  it('skips unchanged words', async () => {
    const deps = createMockRepos()
    const categorized: CategorizedNote[] = [
      { note: makeNote(), category: 'unchanged', existingWord: makeWord() },
    ]

    const result = await executeImport(categorized, [], USER_ID, deps)

    expect(result.skipped).toBe(1)
    expect(result.added).toBe(0)
    expect(result.updated).toBe(0)
    expect(deps.wordRepository.saveBatch).not.toHaveBeenCalled()
    expect(deps.wordRepository.updateBatch).not.toHaveBeenCalled()
  })

  it('handles deck reassignment for updated words', async () => {
    const existingWord = makeWord({ id: 'w1', deckId: 'old-deck', ankiGuid: 'g1' })
    const existingDecks = [
      Deck.create({ id: 'old-deck', name: 'English::Old', userId: USER_ID, language: Language.EN }),
      Deck.create({ id: 'new-deck', name: 'English::New', userId: USER_ID, language: Language.EN }),
    ]
    const deps = createMockRepos(existingDecks)
    const categorized: CategorizedNote[] = [
      {
        note: makeNote({ guid: 'g1', deckName: 'English::New' }),
        category: 'updated',
        existingWord,
        changes: ['deck'],
      },
    ]

    await executeImport(categorized, [], USER_ID, deps)

    const updated = (deps.wordRepository.updateBatch as ReturnType<typeof vi.fn>).mock.calls[0][0] as Word[]
    expect(updated[0].deckId).toBe('new-deck')
  })

  it('reports progress through callback', async () => {
    const deps = createMockRepos()
    const categorized: CategorizedNote[] = [
      { note: makeNote({ guid: 'g1', deckName: 'English::Test' }), category: 'new' },
    ]
    const progress: Array<{ phase: string }> = []

    await executeImport(categorized, ['English', 'English::Test'], USER_ID, deps, (p) => {
      progress.push({ phase: p.phase })
    })

    const phases = progress.map((p) => p.phase)
    expect(phases).toContain('decks')
    expect(phases).toContain('inserting')
    expect(phases).toContain('done')
  })

  it('returns combined result for mixed categories', async () => {
    const existingWord = makeWord({ id: 'w1', ankiGuid: 'g-updated' })
    const existingDecks = [Deck.create({ id: 'deck-en', name: 'English::Test', userId: USER_ID, language: Language.EN })]
    const deps = createMockRepos(existingDecks)
    const categorized: CategorizedNote[] = [
      { note: makeNote({ guid: 'g-new', deckName: 'English::Test' }), category: 'new' },
      { note: makeNote({ guid: 'g-updated', word: 'changed', deckName: 'English::Test' }), category: 'updated', existingWord, changes: ['word'] },
      { note: makeNote({ guid: 'g-skip' }), category: 'unchanged', existingWord: makeWord() },
    ]

    const result = await executeImport(categorized, [], USER_ID, deps)

    expect(result.added).toBe(1)
    expect(result.updated).toBe(1)
    expect(result.skipped).toBe(1)
  })
})
