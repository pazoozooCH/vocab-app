import { useState } from 'react'
import type { Word } from '../../domain/entities/Word'

function renderMarkdown(text: string) {
  // Split on **bold** and _italic_ patterns, preserving delimiters as capture groups
  const tokens = text.split(/(\*\*.+?\*\*|_.+?_)/)
  return tokens.map((token, i) => {
    if (token.startsWith('**') && token.endsWith('**')) {
      return <strong key={i}>{token.slice(2, -2)}</strong>
    }
    if (token.startsWith('_') && token.endsWith('_') && !token.startsWith('__')) {
      return <em key={i}>{token.slice(1, -1)}</em>
    }
    return token
  })
}

interface WordCardProps {
  word: Word
  duplicates?: Word[]
  onDelete?: (word: Word) => void
  onRefine?: (word: Word, context: string) => Promise<void>
}

export function WordCard({ word, duplicates, onDelete, onRefine }: WordCardProps) {
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
        {word.sentencesGerman.map((s, i) => (
          <div key={`de-${i}`} className="word-card__sentence">{renderMarkdown(s)}</div>
        ))}
      </div>

      <div className="word-card__meta">
        <span className="word-card__deck">{word.deck}</span>
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
            <div key={d.id} className="word-card__duplicate">
              <span className="word-card__duplicate-word">{renderMarkdown(d.word)}</span>
              <span className="word-card__duplicate-translations">
                {d.translations.map((t, i) => (
                  <span key={i}>{i > 0 && ', '}{renderMarkdown(t)}</span>
                ))}
              </span>
              <span className="word-card__duplicate-deck">{d.deck}</span>
            </div>
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
