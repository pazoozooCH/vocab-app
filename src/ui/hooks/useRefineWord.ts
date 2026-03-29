import { Word } from '../../domain/entities/Word'
import { WordStatus } from '../../domain/values/WordStatus'
import { useAuth, useServices } from '../context/AppContext'
import { useCallback } from 'react'

export function useRefineWord() {
  const { user } = useAuth()
  const { wordRepository, translationService } = useServices()

  const refine = useCallback(async (originalWord: Word, context: string): Promise<Word> => {
    if (!user) throw new Error('Not authenticated')

    const bareWord = originalWord.word.replace(/\s*_\[.*?\]_$/, '')
    const translation = await translationService.translate(
      bareWord,
      originalWord.language,
      context,
    )

    const refined = Word.create({
      id: originalWord.id,
      userId: originalWord.userId,
      word: translation.word ?? bareWord,
      language: originalWord.language,
      translations: translation.translations,
      sentencesSource: translation.sentencesSource,
      sentencesGerman: translation.sentencesGerman,
      deckId: originalWord.deckId,
      status: originalWord.status as typeof WordStatus.Pending | typeof WordStatus.Exported,
      createdAt: originalWord.createdAt,
      exportedAt: originalWord.exportedAt,
    })

    await wordRepository.update(refined)
    return refined
  }, [user, wordRepository, translationService])

  return refine
}
