import type { Word } from '../../domain/entities/Word'

interface WordCardProps {
  word: Word
  onDelete?: (word: Word) => void
}

export function WordCard({ word, onDelete }: WordCardProps) {
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
        <ul>
          {word.sentencesSource.map((s, i) => (
            <li key={`src-${i}`}>{s}</li>
          ))}
        </ul>
        <ul>
          {word.sentencesGerman.map((s, i) => (
            <li key={`de-${i}`}>{s}</li>
          ))}
        </ul>
      </div>

      <div className="word-card__meta">
        <span className="word-card__deck">{word.deck}</span>
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
  )
}
