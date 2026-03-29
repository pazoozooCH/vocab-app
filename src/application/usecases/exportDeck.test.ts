import { describe, it, expect, vi } from 'vitest'
import { createExport, confirmExport, failExport } from './exportDeck'
import type { WordRepository } from '../ports/WordRepository'
import type { ExportRepository } from '../ports/ExportRepository'
import { Word } from '../../domain/entities/Word'
import { Export } from '../../domain/entities/Export'
import { Language } from '../../domain/values/Language'
import { WordStatus } from '../../domain/values/WordStatus'
import { ExportStatus } from '../../domain/values/ExportStatus'

function makeWord(overrides: Partial<{ word: string; id: string }> = {}): Word {
  return Word.create({
    id: overrides.id ?? 'word-1',
    userId: 'user-123',
    word: overrides.word ?? 'hello',
    language: Language.EN,
    translations: ['hallo'],
    sentencesSource: ['Hello, how are you?'],
    sentencesGerman: ['Hallo, wie geht es dir?'],
    deckId: 'deck-1',
    status: WordStatus.Pending,
    createdAt: new Date('2026-03-25'),
    exportedAt: null,
    ankiGuid: null,
  })
}

function createMockExportRepository(): ExportRepository {
  return {
    save: vi.fn(),
    findById: vi.fn(),
    findAllByUser: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  }
}

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
    updateBatch: vi.fn(),
    delete: vi.fn(),
    findByAnkiGuids: vi.fn().mockResolvedValue([]),
    saveBatch: vi.fn(),
  }
}

describe('createExport', () => {
  it('creates an export record with pending status', async () => {
    const exportRepo = createMockExportRepository()
    const words = [makeWord({ id: 'w1' }), makeWord({ id: 'w2' })]

    const result = await createExport(
      { words, deckFilter: 'deck:English::Basics', userId: 'user-123' },
      { exportRepository: exportRepo },
    )

    expect(exportRepo.save).toHaveBeenCalledOnce()
    expect(result.status).toBe(ExportStatus.PendingConfirmation)
    expect(result.wordIds).toEqual(['w1', 'w2'])
    expect(result.wordCount).toBe(2)
  })
})

describe('confirmExport', () => {
  it('marks words as exported and confirms the export', async () => {
    const exp = Export.create({
      id: 'exp-1',
      userId: 'user-123',
      status: ExportStatus.PendingConfirmation,
      wordIds: ['w1'],
      deckFilter: '',
      wordCount: 1,
      createdAt: new Date(),
    })
    const exportRepo = createMockExportRepository()
    const wordRepo = createMockWordRepository()
    vi.mocked(exportRepo.findById).mockResolvedValue(exp)

    await confirmExport('exp-1', 'user-123', {
      exportRepository: exportRepo,
      wordRepository: wordRepo,
    })

    // Should use batch update, not individual updates
    expect(wordRepo.markExportedBatch).toHaveBeenCalledOnce()
    expect(wordRepo.markExportedBatch).toHaveBeenCalledWith(
      ['w1'],
      'user-123',
      expect.any(Date),
    )
    expect(wordRepo.update).not.toHaveBeenCalled()
    expect(wordRepo.findById).not.toHaveBeenCalled()

    expect(exportRepo.update).toHaveBeenCalledOnce()
    const updatedExport = vi.mocked(exportRepo.update).mock.calls[0][0]
    expect(updatedExport.status).toBe(ExportStatus.Confirmed)
  })
})

describe('failExport', () => {
  it('marks the export as failed', async () => {
    const exp = Export.create({
      id: 'exp-1',
      userId: 'user-123',
      status: ExportStatus.PendingConfirmation,
      wordIds: ['w1'],
      deckFilter: '',
      wordCount: 1,
      createdAt: new Date(),
    })

    const exportRepo = createMockExportRepository()
    vi.mocked(exportRepo.findById).mockResolvedValue(exp)

    await failExport('exp-1', 'user-123', { exportRepository: exportRepo })

    expect(exportRepo.update).toHaveBeenCalledOnce()
    const updated = vi.mocked(exportRepo.update).mock.calls[0][0]
    expect(updated.status).toBe(ExportStatus.Failed)
  })
})
