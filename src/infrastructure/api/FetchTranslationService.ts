import type { Language } from '../../domain/values/Language'
import type {
  TranslationResult,
  TranslationService,
} from '../../application/ports/TranslationService'

export class FetchTranslationService implements TranslationService {
  readonly baseUrl: string
  readonly getAccessToken: () => Promise<string | null>

  constructor(baseUrl: string, getAccessToken: () => Promise<string | null>) {
    this.baseUrl = baseUrl
    this.getAccessToken = getAccessToken
  }

  async translate(word: string, language: Language, context?: string): Promise<TranslationResult> {
    const token = await this.getAccessToken()

    const response = await fetch(`${this.baseUrl}/api/translate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ word, language, ...(context ? { context } : {}) }),
    })

    if (!response.ok) {
      const body = await response.text()
      throw new Error(`Translation failed: ${body}`)
    }

    return response.json()
  }
}
