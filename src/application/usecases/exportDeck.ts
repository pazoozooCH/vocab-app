import type { Word } from '../../domain/entities/Word'
import type { WordRepository } from '../ports/WordRepository'

interface ExportDeckInput {
  deck: string
  userId: string
}

interface ExportDeckDeps {
  wordRepository: WordRepository
}

export async function exportDeck(
  input: ExportDeckInput,
  deps: ExportDeckDeps,
): Promise<Word[]> {
  const pendingWords = await deps.wordRepository.findPendingByDeck(
    input.deck,
    input.userId,
  )

  const now = new Date()
  const exportedWords: Word[] = []

  for (const word of pendingWords) {
    const exported = word.markExported(now)
    await deps.wordRepository.update(exported)
    exportedWords.push(exported)
  }

  return exportedWords
}
