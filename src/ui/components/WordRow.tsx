import type { Word } from '../../domain/entities/Word'
import { renderMarkdown } from './renderMarkdown'

interface WordRowProps {
  word: Word
}

export function WordRow({ word }: WordRowProps) {
  return (
    <div className="word-row">
      <span className="word-row__word">{renderMarkdown(word.word)}</span>
      <span className="word-row__translations">
        {word.translations.map((t, i) => (
          <span key={i}>{i > 0 && ', '}{renderMarkdown(t)}</span>
        ))}
      </span>
      <span className="word-row__deck">{word.deck}</span>
    </div>
  )
}
