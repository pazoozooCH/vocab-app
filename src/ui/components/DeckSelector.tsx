import { useState } from 'react'
import { Deck } from '../../domain/entities/Deck'
import type { Language } from '../../domain/values/Language'
import { useAuth, useServices } from '../context/AppContext'

interface DeckSelectorProps {
  decks: Deck[]
  selectedDeckId: string
  onSelect: (deckId: string) => void
  onDeckCreated?: () => Promise<void> | void
  onDeckDeleted?: () => Promise<void> | void
  allowAll?: boolean
  language?: Language
}

export function DeckSelector({
  decks,
  selectedDeckId,
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
    try {
      await deckRepository.save(deck)
    } catch (err) {
      setCreateError(`Failed to create deck: ${err instanceof Error ? err.message : String(err)}`)
      return
    }
    setNewDeckName('')
    setCreateError(null)
    setIsCreating(false)
    await onDeckCreated?.()
    onSelect(deck.id)
  }

  const handleDelete = async () => {
    if (!user || !selectedDeckId) return
    const deck = decks.find((d) => d.id === selectedDeckId)
    if (!deck) return

    const words = await wordRepository.findByDeckId(deck.id, user.id)
    if (words.length > 0) {
      const confirmed = confirm(
        `Delete deck "${deck.name}"? It contains ${words.length} word${words.length > 1 ? 's' : ''} that will also be deleted.`,
      )
      if (!confirmed) return
    }

    // Cascade delete: words are automatically deleted by the foreign key constraint
    await deckRepository.delete(deck.id, user.id)
    onSelect('')
    await onDeckDeleted?.()
  }

  return (
    <div className="deck-selector">
      <div className="deck-selector__row">
        <select
          id="deck-select"
          className="deck-selector__select"
          value={selectedDeckId}
          onChange={(e) => {
            if (e.target.value === '__new__') {
              setIsCreating(true)
            } else {
              onSelect(e.target.value)
            }
          }}
        >
          {allowAll && <option value="">All decks</option>}
          {!allowAll && (
            <option value="">
              Select a deck…
            </option>
          )}
          {decks.map((d) => (
            <option key={d.id} value={d.id}>
              {d.name}
            </option>
          ))}
          {language && <option value="__new__">+ New deck</option>}
        </select>
        {selectedDeckId && (
          <button
            id="delete-deck-btn"
            className="btn btn--small btn--danger btn--icon"
            onClick={handleDelete}
            title="Delete deck"
            aria-label="Delete deck"
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
