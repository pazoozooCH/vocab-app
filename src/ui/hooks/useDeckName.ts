import type { Deck } from '../../domain/entities/Deck'

export function getDeckName(deckId: string, decks: Deck[]): string {
  return decks.find((d) => d.id === deckId)?.name ?? ''
}
