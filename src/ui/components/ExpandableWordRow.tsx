import { useState } from 'react'
import type { Word } from '../../domain/entities/Word'
import { WordRow } from './WordRow'
import { WordCard } from './WordCard'

interface ExpandableWordRowProps {
  word: Word
  defaultExpanded?: boolean
  duplicates?: Word[]
  onDelete?: (word: Word) => void
  onRefine?: (word: Word, context: string) => Promise<void>
}

export function ExpandableWordRow({
  word,
  defaultExpanded = false,
  duplicates,
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
          duplicates={duplicates}
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
      <WordRow word={word} />
    </div>
  )
}
