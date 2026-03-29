import type { Word } from '../../domain/entities/Word'
import { renderMarkdown } from './renderMarkdown'

interface WordRowProps {
  word: Word
  deckName?: string
  showLanguage?: boolean
  highlight?: string
}

export function WordRow({ word, deckName, showLanguage, highlight }: WordRowProps) {
  return (
    <div className="word-row">
      {showLanguage && (
        <span className={`badge badge--${word.language.toLowerCase()} badge--small`}>
          {word.language}
        </span>
      )}
      <span className="word-row__word">{renderMarkdown(word.word, highlight)}</span>
      <span className="word-row__translations">
        {word.translations.map((t, i) => (
          <span key={i}>{i > 0 && ', '}{renderMarkdown(t, highlight)}</span>
        ))}
      </span>
      {deckName && <span className="word-row__deck">{deckName}</span>}
    </div>
  )
}
