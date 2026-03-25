import { useState } from 'react'
import type { Word } from '../../domain/entities/Word'

function renderBold(text: string) {
  const parts = text.split(/\*\*(.+?)\*\*/)
  return parts.map((part, i) =>
    i % 2 === 1 ? <strong key={i}>{part}</strong> : part,
  )
}

interface WordCardProps {
  word: Word
  onDelete?: (word: Word) => void
  onRefine?: (word: Word, context: string) => Promise<void>
}

export function WordCard({ word, onDelete, onRefine }: WordCardProps) {
  const [isRefining, setIsRefining] = useState(false)
  const [context, setContext] = useState('')
  const [loading, setLoading] = useState(false)

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
        <span className="word-card__word">{word.word}</span>
        <span className={`badge badge--${word.language.toLowerCase()}`}>
          {word.language}
        </span>
        <span className={`badge badge--${word.status}`}>{word.status}</span>
      </div>

      <div className="word-card__translations">
        {word.translations.join(', ')}
      </div>

      <div className="word-card__sentences">
        {word.sentencesSource.map((s, i) => (
          <div key={`src-${i}`} className="word-card__sentence">{renderBold(s)}</div>
        ))}
        {word.sentencesGerman.map((s, i) => (
          <div key={`de-${i}`} className="word-card__sentence">{renderBold(s)}</div>
        ))}
      </div>

      <div className="word-card__meta">
        <span className="word-card__deck">{word.deck}</span>
        <div className="word-card__actions">
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
