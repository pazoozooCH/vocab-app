import { useState } from 'react'
import { Deck } from '../../domain/entities/Deck'
import type { Language } from '../../domain/values/Language'
import { useAuth, useServices } from '../context/AppContext'

interface DeckSelectorProps {
  decks: Deck[]
  selectedDeck: string
  onSelect: (deck: string) => void
  onDeckCreated?: () => void
  allowAll?: boolean
  language?: Language
}

export function DeckSelector({
  decks,
  selectedDeck,
  onSelect,
  onDeckCreated,
  allowAll,
  language,
}: DeckSelectorProps) {
  const { deckRepository } = useServices()
  const { user } = useAuth()
  const [isCreating, setIsCreating] = useState(false)
  const [newDeckName, setNewDeckName] = useState('')

  const handleCreate = async () => {
    if (!user || !newDeckName.trim() || !language) return
    const deck = Deck.create({
      id: crypto.randomUUID(),
      userId: user.id,
      name: newDeckName.trim(),
      language,
    })
    await deckRepository.save(deck)
    setNewDeckName('')
    setIsCreating(false)
    onDeckCreated?.()
    onSelect(deck.name)
  }

  return (
    <div className="deck-selector">
      <select
        className="deck-selector__select"
        value={selectedDeck}
        onChange={(e) => {
          if (e.target.value === '__new__') {
            setIsCreating(true)
          } else {
            onSelect(e.target.value)
          }
        }}
      >
        {allowAll && <option value="">All decks</option>}
        {!allowAll && !selectedDeck && (
          <option value="" disabled>
            Select a deck…
          </option>
        )}
        {decks.map((d) => (
          <option key={d.id} value={d.name}>
            {d.name}
          </option>
        ))}
        {language && <option value="__new__">+ New deck</option>}
      </select>

      {isCreating && (
        <div className="deck-selector__create">
          <input
            className="deck-selector__input"
            type="text"
            placeholder="e.g. English::Vocabulary or French::Verbs"
            value={newDeckName}
            onChange={(e) => setNewDeckName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
            autoFocus
          />
          <button className="btn btn--small" onClick={handleCreate}>
            Create
          </button>
          <button
            className="btn btn--small btn--ghost"
            onClick={() => setIsCreating(false)}
          >
            Cancel
          </button>
        </div>
      )}
    </div>
  )
}
