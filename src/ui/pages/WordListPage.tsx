import { useState } from 'react'
import type { WordStatus } from '../../domain/values/WordStatus'
import { WordStatus as WordStatusEnum } from '../../domain/values/WordStatus'
import { useAuth, useServices } from '../context/AppContext'
import { useDecks } from '../hooks/useDecks'
import { useWords } from '../hooks/useWords'
import { DeckSelector } from '../components/DeckSelector'
import { WordCard } from '../components/WordCard'
import type { Word } from '../../domain/entities/Word'

export function WordListPage() {
  const { user } = useAuth()
  const { wordRepository } = useServices()
  const { decks, reload: reloadDecks } = useDecks()
  const [deck, setDeck] = useState('')
  const [status, setStatus] = useState<WordStatus | ''>('')
  const { words, loading, reload } = useWords({
    deck: deck || undefined,
    status: (status as WordStatus) || undefined,
  })

  const handleDelete = async (word: Word) => {
    if (!user) return
    if (!confirm(`Delete "${word.word}"?`)) return
    await wordRepository.delete(word.id, user.id)
    reload()
  }

  return (
    <div className="word-list-page">
      <div className="word-list-filters">
        <DeckSelector
          decks={decks}
          selectedDeck={deck}
          onSelect={setDeck}
          onDeckCreated={reloadDecks}
          allowAll
        />

        <div className="status-filter">
          <button
            className={`status-filter__btn ${status === '' ? 'status-filter__btn--active' : ''}`}
            onClick={() => setStatus('')}
          >
            All
          </button>
          <button
            className={`status-filter__btn ${status === WordStatusEnum.Pending ? 'status-filter__btn--active' : ''}`}
            onClick={() => setStatus(WordStatusEnum.Pending)}
          >
            Pending
          </button>
          <button
            className={`status-filter__btn ${status === WordStatusEnum.Exported ? 'status-filter__btn--active' : ''}`}
            onClick={() => setStatus(WordStatusEnum.Exported)}
          >
            Exported
          </button>
        </div>
      </div>

      {loading ? (
        <div className="loading-text">Loading…</div>
      ) : words.length === 0 ? (
        <div className="empty-state">No words found.</div>
      ) : (
        <div className="word-list">
          {words.map((w) => (
            <WordCard key={w.id} word={w} onDelete={handleDelete} />
          ))}
        </div>
      )}
    </div>
  )
}
