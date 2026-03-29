import { useState, useRef } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useAuth, useServices } from '../context/AppContext'
import { parseApkg } from '../../infrastructure/anki/parseApkg'
import type { ParseResult } from '../../infrastructure/anki/parseApkg'
import { analyzeImport } from '../../application/usecases/analyzeImport'
import type { ImportAnalysis, CategorizedNote } from '../../application/usecases/analyzeImport'
import { executeImport } from '../../application/usecases/executeImport'
import type { ImportProgress, ImportResult } from '../../application/usecases/executeImport'

type ImportStep = 'upload' | 'analyzing' | 'preview' | 'importing' | 'done' | 'error'

export function ImportPage() {
  const { user } = useAuth()
  const { wordRepository, deckRepository } = useServices()
  const queryClient = useQueryClient()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [step, setStep] = useState<ImportStep>('upload')
  const [error, setError] = useState<string | null>(null)
  const [, setParseResult] = useState<ParseResult | null>(null)
  const [analysis, setAnalysis] = useState<ImportAnalysis | null>(null)
  const [fileName, setFileName] = useState<string>('')
  const [progress, setProgress] = useState<ImportProgress | null>(null)
  const [result, setResult] = useState<ImportResult | null>(null)

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !user) return

    setFileName(file.name)
    setStep('analyzing')
    setError(null)

    try {
      const parsed = await parseApkg(file, '/sql-wasm.wasm')
      setParseResult(parsed)

      const analysisResult = await analyzeImport(
        parsed.notes,
        parsed.skippedDecks,
        user.id,
        { wordRepository, deckRepository },
      )
      setAnalysis(analysisResult)
      setStep('preview')
    } catch (err) {
      console.error('Import analysis failed:', err)
      setError(err instanceof Error ? err.message : 'Failed to analyze file')
      setStep('error')
    }

    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const handleImport = async () => {
    if (!analysis || !user) return

    setStep('importing')
    setProgress(null)

    try {
      const importResult = await executeImport(
        analysis.categorized,
        analysis.summary.newDecks,
        user.id,
        { wordRepository, deckRepository },
        setProgress,
      )
      setResult(importResult)
      setStep('done')

      // Invalidate queries so word list and deck selectors refresh
      await queryClient.invalidateQueries({ queryKey: ['words'] })
      await queryClient.invalidateQueries({ queryKey: ['decks'] })
    } catch (err) {
      console.error('Import failed:', err)
      setError(err instanceof Error ? err.message : 'Import failed')
      setStep('error')
    }
  }

  const handleReset = () => {
    setStep('upload')
    setError(null)
    setParseResult(null)
    setAnalysis(null)
    setFileName('')
    setProgress(null)
    setResult(null)
  }

  return (
    <div className="import-page">
      <h2>Import from Anki</h2>

      {step === 'upload' && (
        <div className="import-upload">
          <p className="import-upload__hint">
            Upload an Anki <code>.apkg</code> export file to import your vocabulary.
          </p>
          <label className="btn btn--primary btn--large" id="import-file-label">
            Choose .apkg file
            <input
              ref={fileInputRef}
              id="import-file-input"
              type="file"
              accept=".apkg"
              onChange={handleFileSelect}
              style={{ display: 'none' }}
            />
          </label>
        </div>
      )}

      {step === 'analyzing' && (
        <div className="loading-text" id="import-analyzing">
          Analyzing {fileName}...
        </div>
      )}

      {step === 'error' && (
        <div>
          <div className="error-message" id="import-error">{error}</div>
          <button className="btn btn--small" onClick={handleReset} style={{ marginTop: 12 }}>
            Try again
          </button>
        </div>
      )}

      {step === 'preview' && analysis && (
        <ImportPreview
          analysis={analysis}
          fileName={fileName}
          onImport={handleImport}
          onCancel={handleReset}
        />
      )}

      {step === 'importing' && progress && (
        <div className="import-progress" id="import-progress">
          <div className="import-progress__phase">
            {progress.phase === 'decks' && 'Creating decks...'}
            {progress.phase === 'inserting' && `Adding words... ${progress.current} / ${progress.total}`}
            {progress.phase === 'updating' && `Updating words... ${progress.current} / ${progress.total}`}
          </div>
          {progress.phase === 'inserting' && progress.total > 0 && (
            <div className="import-progress__bar">
              <div
                className="import-progress__fill"
                style={{ width: `${Math.round((progress.current / progress.total) * 100)}%` }}
              />
            </div>
          )}
        </div>
      )}

      {step === 'importing' && !progress && (
        <div className="loading-text">Starting import...</div>
      )}

      {step === 'done' && result && (
        <div className="import-done" id="import-done">
          <div className="success-message">
            Import complete!
          </div>
          <div className="import-done__stats">
            <div className="import-done__stat">
              <span className="import-done__stat-count">{result.added.toLocaleString()}</span>
              <span className="import-done__stat-label">added</span>
            </div>
            <div className="import-done__stat">
              <span className="import-done__stat-count">{result.updated.toLocaleString()}</span>
              <span className="import-done__stat-label">updated</span>
            </div>
            <div className="import-done__stat">
              <span className="import-done__stat-count">{result.skipped.toLocaleString()}</span>
              <span className="import-done__stat-label">skipped</span>
            </div>
          </div>
          <button className="btn btn--primary btn--large" onClick={handleReset}>
            Import another file
          </button>
        </div>
      )}
    </div>
  )
}

function ImportPreview({
  analysis,
  fileName,
  onImport,
  onCancel,
}: {
  analysis: ImportAnalysis
  fileName: string
  onImport: () => void
  onCancel: () => void
}) {
  const { summary } = analysis
  const actionCount = summary.newCount + summary.updatedCount + summary.vocabSyncCount

  return (
    <div className="import-preview" id="import-preview">
      <div className="import-preview__file">
        {fileName}
      </div>

      <div className="import-preview__section">
        <h3>Notes analyzed: {summary.total.toLocaleString()}</h3>
        <div className="import-preview__categories">
          <div className="import-preview__cat">
            <span className="import-preview__cat-count import-preview__cat-count--new">
              {summary.newCount.toLocaleString()}
            </span>
            <span className="import-preview__cat-label">New words</span>
          </div>
          <div className="import-preview__cat">
            <span className="import-preview__cat-count import-preview__cat-count--unchanged">
              {summary.unchangedCount.toLocaleString()}
            </span>
            <span className="import-preview__cat-label">Unchanged</span>
          </div>
          <div className="import-preview__cat">
            <span className="import-preview__cat-count import-preview__cat-count--updated">
              {summary.updatedCount.toLocaleString()}
            </span>
            <span className="import-preview__cat-label">Updated</span>
          </div>
          <div className="import-preview__cat">
            <span className="import-preview__cat-count import-preview__cat-count--sync">
              {summary.vocabSyncCount.toLocaleString()}
            </span>
            <span className="import-preview__cat-label">Vocab sync</span>
          </div>
        </div>
      </div>

      <div className="import-preview__section">
        <h3>By language</h3>
        <div className="import-preview__table">
          {Object.entries(summary.byLanguage).map(([lang, count]) => (
            <div key={lang} className="import-preview__row">
              <span>{lang === 'EN' ? 'English' : 'French'}</span>
              <span>{count.toLocaleString()}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="import-preview__section">
        <h3>By note type</h3>
        <div className="import-preview__table">
          {Object.entries(summary.byNoteType).map(([type, count]) => (
            <div key={type} className="import-preview__row">
              <span>{type}</span>
              <span>{count.toLocaleString()}</span>
            </div>
          ))}
        </div>
      </div>

      <DeckBreakdown categorized={analysis.categorized} newDecks={summary.newDecks} />

      {summary.skippedDecks.length > 0 && (
        <div className="import-preview__section">
          <h3>Skipped decks ({summary.skippedDecks.length})</h3>
          <div className="import-preview__deck-list import-preview__deck-list--muted">
            {summary.skippedDecks.map((name) => (
              <div key={name} className="import-preview__deck">{name}</div>
            ))}
          </div>
        </div>
      )}

      <div className="import-preview__actions">
        <button
          id="import-confirm"
          className="btn btn--primary btn--large"
          onClick={onImport}
          disabled={actionCount === 0}
        >
          Import {actionCount.toLocaleString()} words
        </button>
        <button id="import-cancel" className="btn btn--large" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </div>
  )
}

function DeckBreakdown({ categorized, newDecks }: { categorized: CategorizedNote[]; newDecks: string[] }) {
  // Count categories per deck — all decks, not just new ones
  const deckStats = new Map<string, { new: number; updated: number; unchanged: number }>()
  for (const { note, category } of categorized) {
    let stats = deckStats.get(note.deckName)
    if (!stats) {
      stats = { new: 0, updated: 0, unchanged: 0 }
      deckStats.set(note.deckName, stats)
    }
    if (category === 'new') stats.new++
    else if (category === 'updated' || category === 'vocab-sync') stats.updated++
    else if (category === 'unchanged') stats.unchanged++
  }

  // Include parent-only new decks (no direct notes)
  for (const name of newDecks) {
    if (!deckStats.has(name)) {
      deckStats.set(name, { new: 0, updated: 0, unchanged: 0 })
    }
  }

  const newDeckSet = new Set(newDecks)
  const sorted = [...deckStats.entries()].sort((a, b) => a[0].localeCompare(b[0]))

  if (sorted.length === 0) return null

  return (
    <div className="import-preview__section">
      <h3>By deck ({sorted.length})</h3>
      <div className="import-preview__table">
        <div className="import-preview__row import-preview__row--header">
          <span>Deck</span>
          <span className="import-preview__row-counts">
            <span title="New">+</span>
            <span title="Updated">~</span>
            <span title="Unchanged">=</span>
          </span>
        </div>
        {sorted.map(([name, stats]) => {
          const total = stats.new + stats.updated + stats.unchanged
          const isNew = newDeckSet.has(name)
          return (
            <div key={name} className="import-preview__row">
              <span className="import-preview__deck-name">
                {name}
                {isNew && <span className="import-preview__new-badge">new</span>}
              </span>
              {total > 0 ? (
                <span className="import-preview__row-counts">
                  <span className="import-preview__count--new">{stats.new}</span>
                  <span className="import-preview__count--updated">{stats.updated}</span>
                  <span className="import-preview__count--unchanged">{stats.unchanged}</span>
                </span>
              ) : (
                <span className="import-preview__count--unchanged">parent</span>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
