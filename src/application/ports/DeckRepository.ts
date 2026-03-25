import type { Deck } from '../../domain/entities/Deck'
import type { Language } from '../../domain/values/Language'

export interface DeckRepository {
  save(deck: Deck): Promise<void>
  findById(id: string, userId: string): Promise<Deck | null>
  findAllByUser(userId: string): Promise<Deck[]>
  findByLanguage(language: Language, userId: string): Promise<Deck[]>
  update(deck: Deck): Promise<void>
  delete(id: string, userId: string): Promise<void>
}
