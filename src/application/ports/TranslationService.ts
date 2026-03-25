import type { Language } from '../../domain/values/Language'

export interface TranslationResult {
  word?: string
  translations: string[]
  sentencesSource: string[]
  sentencesGerman: string[]
}

export interface TranslationService {
  translate(word: string, language: Language, context?: string): Promise<TranslationResult>
}
