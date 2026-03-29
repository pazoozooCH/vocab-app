import { useState, useMemo } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
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
import { getDeckName } from '../hooks/useDeckName'

type DeckFilter = string

function parseDeckFilter(filter: DeckFilter): { deckId?: string; language?: Language } {
  if (!filter) return {}
  if (filter === Language.EN || filter === Language.FR) return { language: filter }
  if (filter.startsWith('deck:')) return { deckId: filter.slice(5) }
  return {}
}

export function ExportPage() {
  const { user } = useAuth()
  const { wordRepository, exportRepository } = useServices()
  const { decks } = useDecks()
  const queryClient = useQueryClient()
  const [deckFilter, setDeckFilter] = useState<DeckFilter>('')
  const [exporting, setExporting] = useState(false)

  const { deckId: filterDeckId, language: filterLanguage } = useMemo(
    () => parseDeckFilter(deckFilter),
    [deckFilter],
  )

  const { total: pendingTotal, reload: reloadPending } = useWords({
    deckId: filterDeckId || undefined,
    language: filterLanguage || undefined,
    status: WordStatus.Pending,
  })

  const enDecks = useMemo(() => decks.filter((d) => d.language === Language.EN), [decks])
  const frDecks = useMemo(() => decks.filter((d) => d.language === Language.FR), [decks])

  // Load exports and their words via TanStack Query
  const { data: exportsData } = useQuery({
    queryKey: ['exports', user?.id],
    queryFn: async () => {
      const exps = await exportRepository.findAllByUser(user!.id)
      // Collect all unique word IDs across all exports and fetch in one batch
      const allWordIds = [...new Set(exps.flatMap((e) => e.wordIds))]
      const allWords = await wordRepository.findByIds(allWordIds, user!.id)
      const wordById = new Map(allWords.map((w) => [w.id, w]))
      const wordsMap: Record<string, Word[]> = {}
      for (const exp of exps) {
        wordsMap[exp.id] = exp.wordIds
          .map((id) => wordById.get(id))
          .filter((w): w is Word => w !== undefined)
      }
      return { exports: exps, exportWords: wordsMap }
    },
    enabled: !!user,
  })

  const exports = exportsData?.exports ?? []
  const exportWords = exportsData?.exportWords ?? {}

  const invalidateExports = async () => {
    await queryClient.invalidateQueries({ queryKey: ['exports'] })
  }

  const handleExport = async () => {
    if (!user || pendingTotal === 0) return
    setExporting(true)
    try {
      // Load ALL pending words for export (not just the visible page)
      const allPending = await wordRepository.findPaginated(user.id, {
        deckId: filterDeckId || undefined,
        language: filterLanguage || undefined,
        status: WordStatus.Pending,
        offset: 0,
        limit: 10000,
      })
      const pendingWords = allPending.words

      // Build words with their deck names for the .apkg generator
      const wordsWithDecks = pendingWords.map((w) => ({
        word: w,
        deckName: getDeckName(w.deckId, decks) || 'Vocab',
      }))

      // File name from filter or first deck
      const exportFileName = filterDeckId
        ? getDeckName(filterDeckId, decks) || 'Vocab'
        : wordsWithDecks[0].deckName

      // Generate and download .apkg
      const blob = await generateApkg(wordsWithDecks, '/sql-wasm.wasm')
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${exportFileName.replace(/::/g, '_')}.apkg`
      a.click()
      URL.revokeObjectURL(url)

      // Create export record
      await createExport(
        { words: pendingWords, deckFilter, userId: user.id },
        { exportRepository },
      )

      await invalidateExports()
    } finally {
      setExporting(false)
    }
  }

  const handleConfirm = async (exp: ExportEntity) => {
    if (!user) return
    await confirmExport(exp.id, user.id, { exportRepository, wordRepository })
    await invalidateExports()
    await reloadPending()
  }

  const handleFail = async (exp: ExportEntity) => {
    if (!user) return
    await failExport(exp.id, user.id, { exportRepository })
    await invalidateExports()
  }

  const handleDelete = async (exp: ExportEntity) => {
    if (!user) return
    if (!confirm('Delete this export record?')) return
    await exportRepository.delete(exp.id, user.id)
    await invalidateExports()
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
        <strong>{pendingTotal} pending word{pendingTotal !== 1 ? 's' : ''}</strong>
      </div>

      {pendingTotal > 0 && (
        <button
          id="export-btn"
          className="btn btn--primary"
          onClick={handleExport}
          disabled={exporting}
        >
          {exporting ? 'Generating…' : `Export ${pendingTotal} words as .apkg`}
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
