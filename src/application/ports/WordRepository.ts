import type { Word } from '../../domain/entities/Word'
import type { Language } from '../../domain/values/Language'
import type { WordStatus } from '../../domain/values/WordStatus'

export type WordSortField = 'created_at' | 'word' | 'translation'
export type WordSortDirection = 'asc' | 'desc'

export interface WordSearchParams {
  deckId?: string
  language?: Language
  status?: WordStatus
  search?: string
  searchSentences?: boolean
  sortBy?: WordSortField
  sortDir?: WordSortDirection
  offset: number
  limit: number
}

export interface WordPage {
  words: Word[]
  total: number
  hasMore: boolean
}

export interface WordRepository {
  save(word: Word): Promise<void>
  findById(id: string, userId: string): Promise<Word | null>
  findByIds(ids: string[], userId: string): Promise<Word[]>
  findByDeckId(deckId: string, userId: string): Promise<Word[]>
  findPendingByDeckId(deckId: string, userId: string): Promise<Word[]>
  findAllByUser(userId: string): Promise<Word[]>
  findPaginated(userId: string, params: WordSearchParams): Promise<WordPage>
  findDuplicates(word: string, language: Language, userId: string, excludeId?: string): Promise<Word[]>
  markExportedBatch(wordIds: string[], userId: string, exportedAt: Date): Promise<void>
  update(word: Word): Promise<void>
  delete(id: string, userId: string): Promise<void>
}
