import { Export } from '../../domain/entities/Export'
import { ExportStatus } from '../../domain/values/ExportStatus'
import type { Word } from '../../domain/entities/Word'
import type { WordRepository } from '../ports/WordRepository'
import type { ExportRepository } from '../ports/ExportRepository'

interface CreateExportInput {
  words: Word[]
  deckFilter: string
  userId: string
}

interface CreateExportDeps {
  exportRepository: ExportRepository
}

export async function createExport(
  input: CreateExportInput,
  deps: CreateExportDeps,
): Promise<Export> {
  const exp = Export.create({
    id: crypto.randomUUID(),
    userId: input.userId,
    status: ExportStatus.PendingConfirmation,
    wordIds: input.words.map((w) => w.id),
    deckFilter: input.deckFilter,
    wordCount: input.words.length,
    createdAt: new Date(),
  })

  await deps.exportRepository.save(exp)
  return exp
}

interface ConfirmExportDeps {
  exportRepository: ExportRepository
  wordRepository: WordRepository
}

export async function confirmExport(
  exportId: string,
  userId: string,
  deps: ConfirmExportDeps,
): Promise<void> {
  const exp = await deps.exportRepository.findById(exportId, userId)
  if (!exp) throw new Error('Export not found')

  const now = new Date()
  for (const wordId of exp.wordIds) {
    const word = await deps.wordRepository.findById(wordId, userId)
    if (word) {
      await deps.wordRepository.update(word.markExported(now))
    }
  }

  await deps.exportRepository.update(exp.withStatus(ExportStatus.Confirmed))
}

interface FailExportDeps {
  exportRepository: ExportRepository
}

export async function failExport(
  exportId: string,
  userId: string,
  deps: FailExportDeps,
): Promise<void> {
  const exp = await deps.exportRepository.findById(exportId, userId)
  if (!exp) throw new Error('Export not found')

  await deps.exportRepository.update(exp.withStatus(ExportStatus.Failed))
}
