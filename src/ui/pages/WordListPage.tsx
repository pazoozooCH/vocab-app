import { useState, useMemo } from 'react'
import type { WordStatus } from '../../domain/values/WordStatus'
import { WordStatus as WordStatusEnum } from '../../domain/values/WordStatus'
import { Language } from '../../domain/values/Language'
import { useAuth, useServices } from '../context/AppContext'
import { useDecks } from '../hooks/useDecks'
import { useWords } from '../hooks/useWords'
import { usePersistedState } from '../hooks/usePersistedState'
import { ExpandableWordRow } from '../components/ExpandableWordRow'
import { getDeckName } from '../hooks/useDeckName'
import type { Word } from '../../domain/entities/Word'

// Filter values: '' = all, 'EN' = all English, 'FR' = all French, 'deck:<id>' = specific deck
type DeckFilter = string

function parseDeckFilter(filter: DeckFilter): { deckId?: string; language?: Language } {
  if (!filter) return {}
  if (filter === Language.EN || filter === Language.FR) return { language: filter }
  if (filter.startsWith('deck:')) return { deckId: filter.slice(5) }
  return {}
}

export function WordListPage() {
  const { user } = useAuth()
  const { wordRepository } = useServices()
  const { decks } = useDecks()
  const [deckFilter, setDeckFilter] = usePersistedState<DeckFilter>('wordList.deck', '')
  const [status, setStatus] = useState<WordStatus | ''>('')

  const { deckId: filterDeckId, language: filterLanguage } = useMemo(
    () => parseDeckFilter(deckFilter),
    [deckFilter],
  )

  const { words: allWords, loading, reload } = useWords({
    deckId: filterDeckId || undefined,
    status: (status as WordStatus) || undefined,
  })

  // Client-side language filter when "all EN" or "all FR" is selected
  const words = useMemo(() => {
    if (!filterLanguage) return allWords
    return allWords.filter((w) => w.language === filterLanguage)
  }, [allWords, filterLanguage])

  const enDecks = useMemo(() => decks.filter((d) => d.language === Language.EN), [decks])
  const frDecks = useMemo(() => decks.filter((d) => d.language === Language.FR), [decks])

  const handleDelete = async (word: Word) => {
    if (!user) return
    if (!confirm(`Delete "${word.word}"?`)) return
    await wordRepository.delete(word.id, user.id)
    reload()
  }

  return (
    <div className="word-list-page">
      <div className="word-list-filters">
        <select
          id="deck-select"
          className="deck-selector__select"
          value={deckFilter}
          onChange={(e) => setDeckFilter(e.target.value)}
        >
          <option value="">All decks</option>
          {enDecks.length > 0 && (
            <>
              <option value="EN">{'\uD83C\uDDEC\uD83C\uDDE7'} English</option>
              {enDecks.map((d) => (
                <option key={d.id} value={`deck:${d.id}`}>{'\u00A0\u00A0\u00A0\u00A0'}{d.name}</option>
              ))}
            </>
          )}
          {frDecks.length > 0 && (
            <>
              <option value="FR">{'\uD83C\uDDEB\uD83C\uDDF7'} French</option>
              {frDecks.map((d) => (
                <option key={d.id} value={`deck:${d.id}`}>{'\u00A0\u00A0\u00A0\u00A0'}{d.name}</option>
              ))}
            </>
          )}
        </select>

        <div className="status-filter">
          <button
            id="filter-all"
            className={`status-filter__btn ${status === '' ? 'status-filter__btn--active' : ''}`}
            onClick={() => setStatus('')}
          >
            All
          </button>
          <button
            id="filter-pending"
            className={`status-filter__btn ${status === WordStatusEnum.Pending ? 'status-filter__btn--active' : ''}`}
            onClick={() => setStatus(WordStatusEnum.Pending)}
          >
            Pending
          </button>
          <button
            id="filter-exported"
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
        <div id="empty-state" className="empty-state">No words found.</div>
      ) : (
        <div id="word-list" className="word-list">
          {words.map((w) => (
            <ExpandableWordRow key={w.id} word={w} deckName={getDeckName(w.deckId, decks)} onDelete={handleDelete} />
          ))}
        </div>
      )}
    </div>
  )
}
