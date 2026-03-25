import { useState, useMemo, useEffect, useCallback } from 'react'
import { Language } from '../../domain/values/Language'
import { WordStatus } from '../../domain/values/WordStatus'
import type { Word } from '../../domain/entities/Word'
import type { Export as ExportEntity } from '../../domain/entities/Export'
import { createExport, confirmExport, failExport } from '../../application/usecases/exportDeck'
import { useAuth, useServices } from '../context/AppContext'
import { useDecks } from '../hooks/useDecks'
import { useWords } from '../hooks/useWords'
import { ExportCard } from '../components/ExportCard'
import { generateApkg } from '../../infrastructure/anki/generateApkg'

type DeckFilter = string

function parseDeckFilter(filter: DeckFilter): { deckId?: string; language?: Language } {
  if (!filter) return {}
  if (filter === Language.EN || filter === Language.FR) return { language: filter }
  if (filter.startsWith('deck:')) return { deckId: filter.slice(5) }
  return {}
}

import { getDeckName } from '../hooks/useDeckName'

function filterLabel(filter: string, decks: import('../../domain/entities/Deck').Deck[]): string {
  if (!filter) return 'All decks'
  if (filter === Language.EN) return 'All English decks'
  if (filter === Language.FR) return 'All French decks'
  if (filter.startsWith('deck:')) return getDeckName(filter.slice(5), decks) || filter.slice(5)
  return filter
}

export function ExportPage() {
  const { user } = useAuth()
  const { wordRepository, exportRepository } = useServices()
  const { decks } = useDecks()
  const [deckFilter, setDeckFilter] = useState<DeckFilter>('')
  const [exporting, setExporting] = useState(false)
  const [exports, setExports] = useState<ExportEntity[]>([])
  const [exportWords, setExportWords] = useState<Record<string, Word[]>>({})

  const { deckId: filterDeckId, language: filterLanguage } = useMemo(
    () => parseDeckFilter(deckFilter),
    [deckFilter],
  )

  const { words: allPending } = useWords({
    deckId: filterDeckId || undefined,
    status: WordStatus.Pending,
  })

  const pendingWords = useMemo(() => {
    if (!filterLanguage) return allPending
    return allPending.filter((w) => w.language === filterLanguage)
  }, [allPending, filterLanguage])

  const enDecks = useMemo(() => decks.filter((d) => d.language === Language.EN), [decks])
  const frDecks = useMemo(() => decks.filter((d) => d.language === Language.FR), [decks])

  const loadExports = useCallback(async () => {
    if (!user) return
    const exps = await exportRepository.findAllByUser(user.id)
    setExports(exps)

    // Load words for each export
    const wordsMap: Record<string, Word[]> = {}
    for (const exp of exps) {
      const words: Word[] = []
      for (const wordId of exp.wordIds) {
        const w = await wordRepository.findById(wordId, user.id)
        if (w) words.push(w)
      }
      wordsMap[exp.id] = words
    }
    setExportWords(wordsMap)
  }, [user, exportRepository, wordRepository])

  useEffect(() => {
    loadExports()
  }, [loadExports])

  const handleExport = async () => {
    if (!user || pendingWords.length === 0) return
    setExporting(true)
    try {
      // Determine deck name for the .apkg
      const deckName = filterLabel(deckFilter, decks)

      // Generate and download .apkg
      const blob = await generateApkg(pendingWords, deckName)
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${deckName.replace(/::/g, '_')}.apkg`
      a.click()
      URL.revokeObjectURL(url)

      // Create export record
      await createExport(
        { words: pendingWords, deckFilter, userId: user.id },
        { exportRepository },
      )

      await loadExports()
    } finally {
      setExporting(false)
    }
  }

  const handleConfirm = async (exp: ExportEntity) => {
    if (!user) return
    await confirmExport(exp.id, user.id, { exportRepository, wordRepository })
    await loadExports()
  }

  const handleFail = async (exp: ExportEntity) => {
    if (!user) return
    await failExport(exp.id, user.id, { exportRepository })
    await loadExports()
  }

  const handleDelete = async (exp: ExportEntity) => {
    if (!user) return
    if (!confirm('Delete this export record?')) return
    await exportRepository.delete(exp.id, user.id)
    await loadExports()
  }

  return (
    <div className="export-page">
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

      <div id="export-summary" className="export-summary">
        <strong>{pendingWords.length} pending word{pendingWords.length !== 1 ? 's' : ''}</strong>
      </div>

      {pendingWords.length > 0 && (
        <button
          id="export-btn"
          className="btn btn--primary"
          onClick={handleExport}
          disabled={exporting}
        >
          {exporting ? 'Generating…' : `Export ${pendingWords.length} words as .apkg`}
        </button>
      )}

      {exports.length > 0 && (
        <div className="export-history">
          <h3>Export History</h3>
          {exports.map((exp) => (
            <ExportCard
              key={exp.id}
              exp={exp}
              words={exportWords[exp.id] ?? []}
              onConfirm={handleConfirm}
              onFail={handleFail}
              onDelete={handleDelete}
            />
          ))}
        </div>
      )}
    </div>
  )
}
