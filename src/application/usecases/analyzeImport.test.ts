import { describe, it, expect, vi } from 'vitest'
import { analyzeImport } from './analyzeImport'
import type { WordRepository } from '../ports/WordRepository'
import type { DeckRepository } from '../ports/DeckRepository'
import type { ParsedNote } from '../../infrastructure/anki/parseApkg'
import { Word } from '../../domain/entities/Word'
import { Deck } from '../../domain/entities/Deck'
import { Language } from '../../domain/values/Language'
import { WordStatus } from '../../domain/values/WordStatus'

const USER_ID = 'user-123'

function makeNote(overrides: Partial<ParsedNote> = {}): ParsedNote {
  return {
    guid: overrides.guid ?? 'note-guid-1',
    word: overrides.word ?? 'hello',
    translations: overrides.translations ?? ['hallo'],
    sentencesSource: overrides.sentencesSource ?? [],
    sentencesGerman: overrides.sentencesGerman ?? [],
    language: overrides.language ?? Language.EN,
    deckName: overrides.deckName ?? 'English::Test',
    noteTypeName: overrides.noteTypeName ?? 'Basic (and reversed card)',
    vocabId: overrides.vocabId ?? null,
  }
}

function makeWord(overrides: Partial<{ id: string; word: string; translations: string[]; deckId: string; ankiGuid: string | null; status: typeof WordStatus.Pending | typeof WordStatus.Exported | typeof WordStatus.Imported }> = {}): Word {
  return Word.create({
    id: overrides.id ?? 'word-1',
    userId: USER_ID,
    word: overrides.word ?? 'hello',
    language: Language.EN,
    translations: overrides.translations ?? ['hallo'],
    sentencesSource: [],
    sentencesGerman: [],
    deckId: overrides.deckId ?? 'deck-en',
    status: overrides.status ?? WordStatus.Imported,
    createdAt: new Date('2026-03-25'),
    exportedAt: null,
    ankiGuid: overrides.ankiGuid ?? 'note-guid-1',
  })
}

function makeDeck(id: string, name: string, language: Language = Language.EN): Deck {
  return Deck.create({ id, name, userId: USER_ID, language })
}

function createMockRepos(opts: {
  wordsByGuid?: Word[]
  wordsByIds?: Word[]
  decks?: Deck[]
} = {}): { wordRepository: WordRepository; deckRepository: DeckRepository } {
  return {
    wordRepository: {
      save: vi.fn(),
      findById: vi.fn(),
      findByIds: vi.fn().mockResolvedValue(opts.wordsByIds ?? []),
      findByDeckId: vi.fn(),
      findPendingByDeckId: vi.fn(),
      findAllByUser: vi.fn(),
      findPaginated: vi.fn(),
      findDuplicates: vi.fn(),
      markExportedBatch: vi.fn(),
      update: vi.fn(),
      updateBatch: vi.fn(),
      delete: vi.fn(),
      findByAnkiGuids: vi.fn().mockResolvedValue(opts.wordsByGuid ?? []),
      saveBatch: vi.fn(),
    },
    deckRepository: {
      save: vi.fn(),
      findById: vi.fn(),
      findAllByUser: vi.fn().mockResolvedValue(opts.decks ?? []),
      findByLanguage: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
  }
}

describe('analyzeImport', () => {
  it('categorizes notes with no existing matches as new', async () => {
    const notes = [makeNote({ guid: 'new-1' }), makeNote({ guid: 'new-2', word: 'world' })]
    const deps = createMockRepos()

    const result = await analyzeImport(notes, [], USER_ID, deps)

    expect(result.summary.newCount).toBe(2)
    expect(result.summary.total).toBe(2)
    expect(result.categorized.every((c) => c.category === 'new')).toBe(true)
  })

  it('categorizes notes with matching guid and identical data as unchanged', async () => {
    const existingWord = makeWord({ ankiGuid: 'existing-1', deckId: 'deck-en' })
    const note = makeNote({ guid: 'existing-1', word: 'hello', translations: ['hallo'], deckName: 'English::Test' })
    const deps = createMockRepos({
      wordsByGuid: [existingWord],
      decks: [makeDeck('deck-en', 'English::Test')],
    })

    const result = await analyzeImport([note], [], USER_ID, deps)

    expect(result.summary.unchangedCount).toBe(1)
    expect(result.categorized[0].category).toBe('unchanged')
    expect(result.categorized[0].existingWord).toBe(existingWord)
  })

  it('categorizes notes with changed word as updated', async () => {
    const existingWord = makeWord({ ankiGuid: 'changed-1', word: 'hello', deckId: 'deck-en' })
    const note = makeNote({ guid: 'changed-1', word: 'HELLO WORLD', deckName: 'English::Test' })
    const deps = createMockRepos({
      wordsByGuid: [existingWord],
      decks: [makeDeck('deck-en', 'English::Test')],
    })

    const result = await analyzeImport([note], [], USER_ID, deps)

    expect(result.summary.updatedCount).toBe(1)
    expect(result.categorized[0].category).toBe('updated')
    expect(result.categorized[0].changes).toContain('word')
  })

  it('categorizes notes with changed translation as updated', async () => {
    const existingWord = makeWord({ ankiGuid: 'trans-1', translations: ['hallo'], deckId: 'deck-en' })
    const note = makeNote({ guid: 'trans-1', translations: ['hallo, grüß Gott'], deckName: 'English::Test' })
    const deps = createMockRepos({
      wordsByGuid: [existingWord],
      decks: [makeDeck('deck-en', 'English::Test')],
    })

    const result = await analyzeImport([note], [], USER_ID, deps)

    expect(result.summary.updatedCount).toBe(1)
    expect(result.categorized[0].changes).toContain('translation')
  })

  it('detects deck reassignment as a change', async () => {
    const existingWord = makeWord({ ankiGuid: 'deck-move', deckId: 'deck-old' })
    const note = makeNote({ guid: 'deck-move', deckName: 'English::NewDeck' })
    const deps = createMockRepos({
      wordsByGuid: [existingWord],
      decks: [makeDeck('deck-old', 'English::OldDeck'), makeDeck('deck-new', 'English::NewDeck')],
    })

    const result = await analyzeImport([note], [], USER_ID, deps)

    expect(result.categorized[0].category).toBe('updated')
    expect(result.categorized[0].changes).toContain('deck')
  })

  it('categorizes Vocab (reversed) notes as vocab-sync when VocabID matches', async () => {
    const existingWord = makeWord({ id: 'vocab-uuid-1', word: 'hello', deckId: 'deck-en', ankiGuid: null })
    const note = makeNote({
      guid: 'vocab-guid-1',
      word: 'HELLO updated',
      vocabId: 'vocab-uuid-1',
      deckName: 'English::Test',
    })
    const deps = createMockRepos({
      wordsByIds: [existingWord],
      decks: [makeDeck('deck-en', 'English::Test')],
    })

    const result = await analyzeImport([note], [], USER_ID, deps)

    expect(result.summary.vocabSyncCount).toBe(1)
    expect(result.categorized[0].category).toBe('vocab-sync')
    expect(result.categorized[0].changes).toContain('word')
  })

  it('treats Vocab (reversed) notes with unknown VocabID as new', async () => {
    const note = makeNote({ guid: 'vocab-new', vocabId: 'unknown-uuid' })
    const deps = createMockRepos()

    const result = await analyzeImport([note], [], USER_ID, deps)

    expect(result.summary.newCount).toBe(1)
    expect(result.categorized[0].category).toBe('new')
  })

  it('reports skipped decks in summary', async () => {
    const deps = createMockRepos()
    const result = await analyzeImport([], ['C1-C2 German-English', 'Japanese'], USER_ID, deps)

    expect(result.summary.skippedDecks).toEqual(['C1-C2 German-English', 'Japanese'])
  })

  it('identifies new decks that need to be created', async () => {
    const notes = [
      makeNote({ deckName: 'English::Test' }),
      makeNote({ guid: 'g2', deckName: 'Français::NewDeck' }),
    ]
    const deps = createMockRepos({
      decks: [makeDeck('d1', 'English'), makeDeck('d2', 'English::Test')],
    })

    const result = await analyzeImport(notes, [], USER_ID, deps)

    expect(result.summary.newDecks).toContain('Français')
    expect(result.summary.newDecks).toContain('Français::NewDeck')
    expect(result.summary.newDecks).not.toContain('English')
    expect(result.summary.newDecks).not.toContain('English::Test')
  })

  it('builds language breakdown in summary', async () => {
    const notes = [
      makeNote({ guid: 'en1', language: Language.EN }),
      makeNote({ guid: 'en2', language: Language.EN }),
      makeNote({ guid: 'fr1', language: Language.FR }),
    ]
    const deps = createMockRepos()

    const result = await analyzeImport(notes, [], USER_ID, deps)

    expect(result.summary.byLanguage).toEqual({ EN: 2, FR: 1 })
  })

  it('builds note type breakdown in summary', async () => {
    const notes = [
      makeNote({ guid: 'b1', noteTypeName: 'Basic (and reversed card)' }),
      makeNote({ guid: 'f1', noteTypeName: 'French Word' }),
      makeNote({ guid: 'f2', noteTypeName: 'French Word' }),
    ]
    const deps = createMockRepos()

    const result = await analyzeImport(notes, [], USER_ID, deps)

    expect(result.summary.byNoteType).toEqual({
      'Basic (and reversed card)': 1,
      'French Word': 2,
    })
  })

  it('handles mixed categories correctly', async () => {
    const existingUnchanged = makeWord({ ankiGuid: 'unchanged-1', word: 'hello', deckId: 'deck-en' })
    const existingUpdated = makeWord({ ankiGuid: 'updated-1', word: 'old word', deckId: 'deck-en' })

    const notes = [
      makeNote({ guid: 'new-1', word: 'brand new' }),
      makeNote({ guid: 'unchanged-1', word: 'hello', deckName: 'English::Test' }),
      makeNote({ guid: 'updated-1', word: 'new word', deckName: 'English::Test' }),
    ]

    const deps = createMockRepos({
      wordsByGuid: [existingUnchanged, existingUpdated],
      decks: [makeDeck('deck-en', 'English::Test')],
    })

    const result = await analyzeImport(notes, [], USER_ID, deps)

    expect(result.summary.newCount).toBe(1)
    expect(result.summary.unchangedCount).toBe(1)
    expect(result.summary.updatedCount).toBe(1)
    expect(result.summary.total).toBe(3)
  })
})
