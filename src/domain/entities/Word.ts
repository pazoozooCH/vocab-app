import type { Language } from '../values/Language'
import type { WordStatus } from '../values/WordStatus'
import { WordStatus as WordStatusEnum } from '../values/WordStatus'

interface WordProps {
  id: string
  userId: string
  word: string
  language: Language
  translations: string[]
  sentencesSource: string[]
  sentencesGerman: string[]
  deckId: string
  status: WordStatus
  createdAt: Date
  exportedAt: Date | null
  ankiGuid: string | null
}

export class Word {
  readonly id: string
  readonly userId: string
  readonly word: string
  readonly language: Language
  readonly translations: readonly string[]
  readonly sentencesSource: readonly string[]
  readonly sentencesGerman: readonly string[]
  readonly deckId: string
  readonly status: WordStatus
  readonly createdAt: Date
  readonly exportedAt: Date | null
  readonly ankiGuid: string | null

  private constructor(props: WordProps) {
    this.id = props.id
    this.userId = props.userId
    this.word = props.word
    this.language = props.language
    this.translations = [...props.translations]
    this.sentencesSource = [...props.sentencesSource]
    this.sentencesGerman = [...props.sentencesGerman]
    this.deckId = props.deckId
    this.status = props.status
    this.createdAt = props.createdAt
    this.exportedAt = props.exportedAt
    this.ankiGuid = props.ankiGuid
  }

  static create(props: WordProps): Word {
    const trimmed = props.word.trim()
    if (trimmed.length === 0) {
      throw new Error('Word cannot be empty')
    }
    if (props.translations.length === 0) {
      throw new Error('At least one translation is required')
    }
    return new Word({ ...props, word: trimmed })
  }

  markExported(exportedAt: Date): Word {
    return new Word({
      id: this.id,
      userId: this.userId,
      word: this.word,
      language: this.language,
      translations: [...this.translations],
      sentencesSource: [...this.sentencesSource],
      sentencesGerman: [...this.sentencesGerman],
      deckId: this.deckId,
      status: WordStatusEnum.Exported,
      createdAt: this.createdAt,
      exportedAt,
      ankiGuid: this.ankiGuid,
    })
  }
}
