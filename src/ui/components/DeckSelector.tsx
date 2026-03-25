import { useState } from 'react'
import { Deck } from '../../domain/entities/Deck'
import type { Language } from '../../domain/values/Language'
import { useAuth, useServices } from '../context/AppContext'

interface DeckSelectorProps {
  decks: Deck[]
  selectedDeck: string
  onSelect: (deck: string) => void
  onDeckCreated?: () => void
  onDeckDeleted?: () => void
  allowAll?: boolean
  language?: Language
}

export function DeckSelector({
  decks,
  selectedDeck,
  onSelect,
  onDeckCreated,
  onDeckDeleted,
  allowAll,
  language,
}: DeckSelectorProps) {
  const { deckRepository, wordRepository } = useServices()
  const { user } = useAuth()
  const [isCreating, setIsCreating] = useState(false)
  const [newDeckName, setNewDeckName] = useState('')
  const [createError, setCreateError] = useState<string | null>(null)

  const handleCreate = async () => {
    if (!user || !newDeckName.trim() || !language) return

    const trimmedName = newDeckName.trim()
    const isDuplicate = decks.some(
      (d) => d.name.toLowerCase() === trimmedName.toLowerCase(),
    )
    if (isDuplicate) {
      setCreateError(`Deck "${trimmedName}" already exists`)
      return
    }

    const deck = Deck.create({
      id: crypto.randomUUID(),
      userId: user.id,
      name: trimmedName,
      language,
    })
    await deckRepository.save(deck)
    setNewDeckName('')
    setCreateError(null)
    setIsCreating(false)
    onDeckCreated?.()
    onSelect(deck.name)
  }

  const handleDelete = async () => {
    if (!user || !selectedDeck) return
    const deck = decks.find((d) => d.name === selectedDeck)
    if (!deck) return

    const words = await wordRepository.findByDeck(deck.name, user.id)
    if (words.length > 0) {
      const confirmed = confirm(
        `Delete deck "${deck.name}"? It contains ${words.length} word${words.length > 1 ? 's' : ''} that will also be deleted.`,
      )
      if (!confirmed) return
      // Delete all words in the deck
      for (const w of words) {
        await wordRepository.delete(w.id, user.id)
      }
    }

    await deckRepository.delete(deck.id, user.id)
    onSelect('')
    onDeckDeleted?.()
  }

  return (
    <div className="deck-selector">
      <div className="deck-selector__row">
        <select
          id="deck-select"
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
        {selectedDeck && (
          <button
            id="delete-deck-btn"
            className="btn btn--small btn--danger btn--icon"
            onClick={handleDelete}
            title={`Delete deck "${selectedDeck}"`}
            aria-label={`Delete deck "${selectedDeck}"`}
          >
            &#x1F5D1;&#xFE0E;
          </button>
        )}
      </div>

      {isCreating && (
        <div className="deck-selector__create">
          <input
            id="new-deck-input"
            className="deck-selector__input"
            type="text"
            placeholder="e.g. English::Vocabulary or French::Verbs"
            value={newDeckName}
            onChange={(e) => { setNewDeckName(e.target.value); setCreateError(null) }}
            onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
            autoFocus
          />
          <button id="create-deck-btn" className="btn btn--small" onClick={handleCreate}>
            Create
          </button>
          <button
            id="cancel-deck-btn"
            className="btn btn--small btn--ghost"
            onClick={() => { setIsCreating(false); setCreateError(null) }}
          >
            Cancel
          </button>
        </div>
      )}
      {createError && (
        <div id="deck-create-error" className="error-message error-message--small">{createError}</div>
      )}
    </div>
  )
}
