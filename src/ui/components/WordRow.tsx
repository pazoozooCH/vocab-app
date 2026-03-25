import type { Word } from '../../domain/entities/Word'
import { renderMarkdown } from './renderMarkdown'

interface WordRowProps {
  word: Word
  deckName?: string
}

export function WordRow({ word, deckName }: WordRowProps) {
  return (
    <div className="word-row">
      <span className="word-row__word">{renderMarkdown(word.word)}</span>
      <span className="word-row__translations">
        {word.translations.map((t, i) => (
          <span key={i}>{i > 0 && ', '}{renderMarkdown(t)}</span>
        ))}
      </span>
      {deckName && <span className="word-row__deck">{deckName}</span>}
    </div>
  )
}
