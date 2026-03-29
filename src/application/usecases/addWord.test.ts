import { describe, it, expect, vi } from 'vitest'
import { addWord } from './addWord'
import type { WordRepository } from '../ports/WordRepository'
import type { TranslationService } from '../ports/TranslationService'
import { Language } from '../../domain/values/Language'
import { WordStatus } from '../../domain/values/WordStatus'

function createMockWordRepository(): WordRepository {
  return {
    save: vi.fn(),
    findById: vi.fn(),
    findByIds: vi.fn().mockResolvedValue([]),
    findByDeckId: vi.fn(),
    findPendingByDeckId: vi.fn(),
    findAllByUser: vi.fn(),
    findPaginated: vi.fn().mockResolvedValue({ words: [], total: 0, hasMore: false }),
    markExportedBatch: vi.fn(),
    findDuplicates: vi.fn().mockResolvedValue([]),
    update: vi.fn(),
    delete: vi.fn(),
  }
}

function createMockTranslationService(): TranslationService {
  return {
    translate: vi.fn().mockResolvedValue({
      translations: ['hallo'],
      sentencesSource: ['Hello, how are you?'],
      sentencesGerman: ['Hallo, wie geht es dir?'],
    }),
  }
}

describe('addWord', () => {
  it('translates and saves a new word', async () => {
    const wordRepo = createMockWordRepository()
    const translationService = createMockTranslationService()

    const result = await addWord(
      {
        word: 'hello',
        language: Language.EN,
        deckId: 'deck-1',
        userId: 'user-123',
      },
      { wordRepository: wordRepo, translationService },
    )

    expect(translationService.translate).toHaveBeenCalledWith(
      'hello',
      Language.EN,
      undefined,
    )
    expect(wordRepo.save).toHaveBeenCalledOnce()
    expect(result.word).toBe('hello')
    expect(result.language).toBe(Language.EN)
    expect(result.translations).toEqual(['hallo'])
    expect(result.sentencesSource).toEqual(['Hello, how are you?'])
    expect(result.sentencesGerman).toEqual(['Hallo, wie geht es dir?'])
    expect(result.deckId).toBe('deck-1')
    expect(result.status).toBe(WordStatus.Pending)
    expect(result.userId).toBe('user-123')
  })

  it('rejects an empty word', async () => {
    const wordRepo = createMockWordRepository()
    const translationService = createMockTranslationService()

    await expect(
      addWord(
        {
          word: '   ',
          language: Language.EN,
          deckId: 'deck-1',
          userId: 'user-123',
        },
        { wordRepository: wordRepo, translationService },
      ),
    ).rejects.toThrow('Word cannot be empty')

    expect(translationService.translate).not.toHaveBeenCalled()
    expect(wordRepo.save).not.toHaveBeenCalled()
  })
})
