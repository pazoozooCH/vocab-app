import { Word } from '../../domain/entities/Word'
import { WordStatus } from '../../domain/values/WordStatus'
import type { Language } from '../../domain/values/Language'
import type { WordRepository } from '../ports/WordRepository'
import type { TranslationService } from '../ports/TranslationService'

interface AddWordInput {
  word: string
  language: Language
  deckId: string
  userId: string
  context?: string
}

interface AddWordDeps {
  wordRepository: WordRepository
  translationService: TranslationService
}

export async function addWord(
  input: AddWordInput,
  deps: AddWordDeps,
): Promise<Word> {
  const trimmed = input.word.trim()
  if (trimmed.length === 0) {
    throw new Error('Word cannot be empty')
  }

  const translation = await deps.translationService.translate(
    trimmed,
    input.language,
    input.context,
  )

  const word = Word.create({
    id: crypto.randomUUID(),
    userId: input.userId,
    word: translation.word ?? trimmed,
    language: input.language,
    translations: translation.translations,
    sentencesSource: translation.sentencesSource,
    sentencesGerman: translation.sentencesGerman,
    deckId: input.deckId,
    status: WordStatus.Pending,
    createdAt: new Date(),
    exportedAt: null,
  })

  await deps.wordRepository.save(word)

  return word
}
