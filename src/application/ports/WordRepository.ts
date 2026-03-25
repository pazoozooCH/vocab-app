import type { Word } from '../../domain/entities/Word'
import type { Language } from '../../domain/values/Language'

export interface WordRepository {
  save(word: Word): Promise<void>
  findById(id: string, userId: string): Promise<Word | null>
  findByDeck(deck: string, userId: string): Promise<Word[]>
  findPendingByDeck(deck: string, userId: string): Promise<Word[]>
  findAllByUser(userId: string): Promise<Word[]>
  findDuplicates(word: string, language: Language, userId: string, excludeId?: string): Promise<Word[]>
  update(word: Word): Promise<void>
  delete(id: string, userId: string): Promise<void>
}
