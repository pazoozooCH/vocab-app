import { useState } from 'react'
import type { Word } from '../../domain/entities/Word'
import { renderMarkdown } from './renderMarkdown'
import { WordRow } from './WordRow'

interface WordCardProps {
  word: Word
  deckName?: string
  duplicates?: Word[]
  onDelete?: (word: Word) => void
  onRefine?: (word: Word, context: string) => Promise<void>
}

export function WordCard({ word, deckName, duplicates, onDelete, onRefine }: WordCardProps) {
  const [isRefining, setIsRefining] = useState(false)
  const [context, setContext] = useState('')
  const [loading, setLoading] = useState(false)
  const [showDuplicates, setShowDuplicates] = useState(false)

  const handleRefine = async () => {
    if (!context.trim() || !onRefine) return
    setLoading(true)
    try {
      await onRefine(word, context.trim())
      setContext('')
      setIsRefining(false)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="word-card">
      <div className="word-card__header">
        <span className="word-card__word">{renderMarkdown(word.word)}</span>
        <span className={`badge badge--${word.language.toLowerCase()}`}>
          {word.language}
        </span>
        <span className={`badge badge--${word.status}`}>{word.status}</span>
      </div>

      <div className="word-card__translations">
        {word.translations.map((t, i) => (
          <span key={i}>{i > 0 && ', '}{renderMarkdown(t)}</span>
        ))}
      </div>

      <div className="word-card__sentences">
        {word.sentencesSource.map((s, i) => (
          <div key={`src-${i}`} className="word-card__sentence">{renderMarkdown(s)}</div>
        ))}
        <div className="word-card__sentence-divider" />
        {word.sentencesGerman.map((s, i) => (
          <div key={`de-${i}`} className="word-card__sentence">{renderMarkdown(s)}</div>
        ))}
      </div>

      <div className="word-card__meta">
        {deckName && <span className="word-card__deck">{deckName}</span>}
        <div className="word-card__actions">
          {duplicates && duplicates.length > 0 && (
            <button
              className="btn btn--small btn--warn"
              onClick={() => setShowDuplicates(!showDuplicates)}
            >
              {showDuplicates ? 'Hide duplicates' : `${duplicates.length} potential duplicate${duplicates.length > 1 ? 's' : ''}`}
            </button>
          )}
          {onRefine && !isRefining && (
            <button
              id="refine-btn"
              className="btn btn--small"
              onClick={() => setIsRefining(true)}
            >
              Refine
            </button>
          )}
          {onDelete && (
            <button
              className="btn btn--small btn--danger"
              onClick={() => onDelete(word)}
            >
              Delete
            </button>
          )}
        </div>
      </div>

      {showDuplicates && duplicates && duplicates.length > 0 && (
        <div className="word-card__duplicates">
          <div className="word-card__duplicates-title">Potential duplicates:</div>
          {duplicates.map((d) => (
            <WordRow key={d.id} word={d} />
          ))}
        </div>
      )}

      {isRefining && (
        <div className="word-card__refine">
          <input
            id="refine-context-input"
            type="text"
            placeholder={`e.g. "for sitting" or "financial"`}
            value={context}
            onChange={(e) => setContext(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleRefine()}
            autoFocus
            disabled={loading}
          />
          <button
            id="refine-submit-btn"
            className="btn btn--small btn--primary"
            onClick={handleRefine}
            disabled={loading || !context.trim()}
          >
            {loading ? 'Refining…' : 'Go'}
          </button>
          <button
            className="btn btn--small btn--ghost"
            onClick={() => { setIsRefining(false); setContext('') }}
          >
            Cancel
          </button>
        </div>
      )}
    </div>
  )
}
