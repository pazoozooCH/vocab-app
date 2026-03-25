import { useState } from 'react'
import { exportDeck } from '../../application/usecases/exportDeck'
import { useAuth, useServices } from '../context/AppContext'
import { useDecks } from '../hooks/useDecks'
import { useWords } from '../hooks/useWords'
import { DeckSelector } from '../components/DeckSelector'
import { WordCard } from '../components/WordCard'
import { WordStatus } from '../../domain/values/WordStatus'

export function ExportPage() {
  const { user } = useAuth()
  const { wordRepository } = useServices()
  const { decks, reload: reloadDecks } = useDecks()
  const [deck, setDeck] = useState('')
  const { words, loading, reload } = useWords({
    deck: deck || undefined,
    status: WordStatus.Pending,
  })
  const [exporting, setExporting] = useState(false)
  const [exportedCount, setExportedCount] = useState<number | null>(null)

  const handleExport = async () => {
    if (!user || !deck) return
    setExporting(true)
    setExportedCount(null)
    try {
      const exported = await exportDeck(
        { deck, userId: user.id },
        { wordRepository },
      )
      setExportedCount(exported.length)
      // TODO: generate .apkg file from exported words and trigger download
      reload()
    } finally {
      setExporting(false)
    }
  }

  return (
    <div className="export-page">
      <DeckSelector
        decks={decks}
        selectedDeck={deck}
        onSelect={(d) => {
          setDeck(d)
          setExportedCount(null)
        }}
        onDeckCreated={reloadDecks}
      />

      {deck && (
        <>
          <div id="export-summary" className="export-summary">
            {loading ? (
              'Loading…'
            ) : (
              <strong>{words.length} pending word{words.length !== 1 ? 's' : ''}</strong>
            )}
          </div>

          {!loading && words.length > 0 && (
            <>
              <button
                id="export-btn"
                className="btn btn--primary"
                onClick={handleExport}
                disabled={exporting}
              >
                {exporting ? 'Exporting…' : `Export ${words.length} words`}
              </button>

              <div className="word-list">
                {words.map((w) => (
                  <WordCard key={w.id} word={w} />
                ))}
              </div>
            </>
          )}

          {exportedCount !== null && (
            <div id="export-success" className="success-message">
              Marked {exportedCount} word{exportedCount !== 1 ? 's' : ''} as exported.
              .apkg download coming soon.
            </div>
          )}
        </>
      )}
    </div>
  )
}
