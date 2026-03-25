import type { Word } from '../../domain/entities/Word'

export interface WordRepository {
  save(word: Word): Promise<void>
  findById(id: string, userId: string): Promise<Word | null>
  findByDeck(deck: string, userId: string): Promise<Word[]>
  findPendingByDeck(deck: string, userId: string): Promise<Word[]>
  findAllByUser(userId: string): Promise<Word[]>
  update(word: Word): Promise<void>
  delete(id: string, userId: string): Promise<void>
}
