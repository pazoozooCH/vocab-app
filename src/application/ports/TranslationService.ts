import type { Language } from '../../domain/values/Language'

export interface TranslationResult {
  translations: string[]
  sentencesSource: string[]
  sentencesGerman: string[]
}

export interface TranslationService {
  translate(word: string, language: Language): Promise<TranslationResult>
}
