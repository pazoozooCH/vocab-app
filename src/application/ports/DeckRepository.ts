import type { Deck } from '../../domain/entities/Deck'

export interface DeckRepository {
  save(deck: Deck): Promise<void>
  findById(id: string, userId: string): Promise<Deck | null>
  findAllByUser(userId: string): Promise<Deck[]>
  update(deck: Deck): Promise<void>
  delete(id: string, userId: string): Promise<void>
}
