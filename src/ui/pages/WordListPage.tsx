import { useState, useMemo, useRef, useCallback, useEffect } from 'react'
import type { WordStatus } from '../../domain/values/WordStatus'
import { WordStatus as WordStatusEnum } from '../../domain/values/WordStatus'
import { Language } from '../../domain/values/Language'
import { useAuth, useServices } from '../context/AppContext'
import { useDecks } from '../hooks/useDecks'
import { useWords } from '../hooks/useWords'
import { usePersistedState } from '../hooks/usePersistedState'
import type { WordSortField, WordSortDirection } from '../../application/ports/WordRepository'
import { ExpandableWordRow } from '../components/ExpandableWordRow'
import { getDeckName } from '../hooks/useDeckName'
import type { Word } from '../../domain/entities/Word'
import { WordStatus as WordStatusValues } from '../../domain/values/WordStatus'
import { useRefineWord } from '../hooks/useRefineWord'

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
  const [search, setSearch] = useState('')
  const [searchSentences, setSearchSentences] = useState(false)
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [sortBy, setSortBy] = usePersistedState<WordSortField>('wordList.sortBy', 'created_at')
  const [sortDir, setSortDir] = usePersistedState<WordSortDirection>('wordList.sortDir', 'desc')
  const [showSortMenu, setShowSortMenu] = useState(false)

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 300)
    return () => clearTimeout(timer)
  }, [search])

  const { deckId: filterDeckId, language: filterLanguage } = useMemo(
    () => parseDeckFilter(deckFilter),
    [deckFilter],
  )

  const { words, total, loading, hasMore, loadingMore, loadMore, reload } = useWords({
    deckId: filterDeckId || undefined,
    language: filterLanguage || undefined,
    status: (status as WordStatus) || undefined,
    search: debouncedSearch || undefined,
    searchSentences,
    sortBy,
    sortDir,
  })

  const handleSort = (field: WordSortField, dir: WordSortDirection) => {
    setSortBy(field)
    setSortDir(dir)
    setShowSortMenu(false)
  }

  const sortLabel = sortBy === 'created_at'
    ? (sortDir === 'desc' ? 'Newest' : 'Oldest')
    : sortBy === 'word' ? 'A→Z (word)' : 'A→Z (translation)'

  const enDecks = useMemo(() => decks.filter((d) => d.language === Language.EN), [decks])
  const frDecks = useMemo(() => decks.filter((d) => d.language === Language.FR), [decks])

  const sentinelRef = useRef<HTMLDivElement>(null)

  // Infinite scroll: observe sentinel element to load more
  const observerCallback = useCallback(
    (entries: IntersectionObserverEntry[]) => {
      if (entries[0].isIntersecting && hasMore && !loadingMore) {
        loadMore()
      }
    },
    [hasMore, loadingMore, loadMore],
  )

  useEffect(() => {
    const sentinel = sentinelRef.current
    if (!sentinel) return
    const observer = new IntersectionObserver(observerCallback, { rootMargin: '200px' })
    observer.observe(sentinel)
    return () => observer.disconnect()
  }, [observerCallback])

  const handleDelete = async (word: Word) => {
    if (!user) return
    if (!confirm(`Delete "${word.word}"?`)) return
    await wordRepository.delete(word.id, user.id)
    reload()
  }

  const refineWord = useRefineWord()

  const handleRefine = async (originalWord: Word, context: string) => {
    await refineWord(originalWord, context)
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
          <button
            id="filter-imported"
            className={`status-filter__btn ${status === WordStatusEnum.Imported ? 'status-filter__btn--active' : ''}`}
            onClick={() => setStatus(WordStatusEnum.Imported)}
          >
            Imported
          </button>
        </div>

        <div className="search-filter">
          <input
            id="search-input"
            type="text"
            placeholder="Search words…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <label className="search-filter__sentences">
            <input
              type="checkbox"
              checked={searchSentences}
              onChange={(e) => setSearchSentences(e.target.checked)}
            />
            Include sentences
          </label>
          <div className="sort-control">
            <button
              className="sort-control__btn"
              onClick={() => setShowSortMenu((v) => !v)}
            >
              ↕ {sortLabel}
            </button>
            {showSortMenu && (
              <div className="sort-control__menu">
                <button className={sortBy === 'created_at' && sortDir === 'desc' ? 'active' : ''} onClick={() => handleSort('created_at', 'desc')}>Newest first</button>
                <button className={sortBy === 'created_at' && sortDir === 'asc' ? 'active' : ''} onClick={() => handleSort('created_at', 'asc')}>Oldest first</button>
                <button className={sortBy === 'word' ? 'active' : ''} onClick={() => handleSort('word', 'asc')}>Word A→Z</button>
                <button className={sortBy === 'translation' ? 'active' : ''} onClick={() => handleSort('translation', 'asc')}>Translation A→Z</button>
              </div>
            )}
          </div>
        </div>
      </div>

      {loading ? (
        <div className="loading-text">Loading…</div>
      ) : words.length === 0 ? (
        <div id="empty-state" className="empty-state">
          {debouncedSearch ? 'No matching words found.' : 'No words found.'}
        </div>
      ) : (
        <div id="word-list" className="word-list">
          <div className="word-list__count">
            {total} word{total !== 1 ? 's' : ''}
            {debouncedSearch && ` matching "${debouncedSearch}"`}
          </div>
          {words.map((w) => (
            <ExpandableWordRow key={w.id} word={w} deckName={getDeckName(w.deckId, decks)} highlight={debouncedSearch} onDelete={handleDelete} onRefine={w.status === WordStatusValues.Pending ? handleRefine : undefined} />
          ))}
          {hasMore && (
            <div ref={sentinelRef} className="word-list__loading">
              {loadingMore ? 'Loading more…' : ''}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
