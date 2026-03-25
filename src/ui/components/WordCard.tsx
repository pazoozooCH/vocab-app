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
        {word.sentencesSource.map((s, i) => (
          <div key={`src-${i}`} className="word-card__sentence">{s}</div>
        ))}
        {word.sentencesGerman.map((s, i) => (
          <div key={`de-${i}`} className="word-card__sentence">{s}</div>
        ))}
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
