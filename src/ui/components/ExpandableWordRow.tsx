import { useState } from 'react'
import type { Word } from '../../domain/entities/Word'
import { WordRow } from './WordRow'
import { WordCard } from './WordCard'

interface ExpandableWordRowProps {
  word: Word
  deckName?: string
  defaultExpanded?: boolean
  duplicates?: Word[]
  highlight?: string
  onDelete?: (word: Word) => void
  onRefine?: (word: Word, context: string) => Promise<void>
}

export function ExpandableWordRow({
  word,
  deckName,
  defaultExpanded = false,
  duplicates,
  highlight,
  onDelete,
  onRefine,
}: ExpandableWordRowProps) {
  const [expanded, setExpanded] = useState(defaultExpanded)

  if (expanded) {
    return (
      <div className="expandable-word-row">
        <button
          className="expandable-word-row__collapse"
          onClick={() => setExpanded(false)}
          aria-label="Collapse"
        >
          Collapse
        </button>
        <WordCard
          word={word}
          deckName={deckName}
          duplicates={duplicates}
          highlight={highlight}
          onDelete={onDelete}
          onRefine={onRefine}
        />
      </div>
    )
  }

  return (
    <div
      className="expandable-word-row expandable-word-row--collapsed"
      onClick={() => setExpanded(true)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === 'Enter' && setExpanded(true)}
    >
      <WordRow word={word} deckName={deckName} showLanguage highlight={highlight} />
    </div>
  )
}
