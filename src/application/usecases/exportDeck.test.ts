import { describe, it, expect, vi } from 'vitest'
import { exportDeck } from './exportDeck'
import type { WordRepository } from '../ports/WordRepository'
import { Word } from '../../domain/entities/Word'
import { Language } from '../../domain/values/Language'
import { WordStatus } from '../../domain/values/WordStatus'

function createMockWordRepository(
  pendingWords: Word[] = [],
): WordRepository {
  return {
    save: vi.fn(),
    findById: vi.fn(),
    findByDeck: vi.fn(),
    findPendingByDeck: vi.fn().mockResolvedValue(pendingWords),
    findAllByUser: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  }
}

function makeWord(overrides: Partial<{ word: string; id: string }> = {}): Word {
  return Word.create({
    id: overrides.id ?? 'word-1',
    userId: 'user-123',
    word: overrides.word ?? 'hello',
    language: Language.EN,
    translations: ['hallo'],
    sentencesSource: ['Hello, how are you?'],
    sentencesGerman: ['Hallo, wie geht es dir?'],
    deck: 'English::Basics',
    status: WordStatus.Pending,
    createdAt: new Date('2026-03-25'),
    exportedAt: null,
  })
}

describe('exportDeck', () => {
  it('returns pending words and marks them as exported', async () => {
    const words = [
      makeWord({ id: 'word-1', word: 'hello' }),
      makeWord({ id: 'word-2', word: 'goodbye' }),
    ]
    const wordRepo = createMockWordRepository(words)

    const result = await exportDeck(
      { deck: 'English::Basics', userId: 'user-123' },
      { wordRepository: wordRepo },
    )

    expect(wordRepo.findPendingByDeck).toHaveBeenCalledWith(
      'English::Basics',
      'user-123',
    )
    expect(result).toHaveLength(2)
    expect(result[0].status).toBe(WordStatus.Exported)
    expect(result[1].status).toBe(WordStatus.Exported)
    expect(result[0].exportedAt).toBeInstanceOf(Date)
    expect(wordRepo.update).toHaveBeenCalledTimes(2)
  })

  it('returns empty array when no pending words', async () => {
    const wordRepo = createMockWordRepository([])

    const result = await exportDeck(
      { deck: 'English::Basics', userId: 'user-123' },
      { wordRepository: wordRepo },
    )

    expect(result).toEqual([])
    expect(wordRepo.update).not.toHaveBeenCalled()
  })
})
