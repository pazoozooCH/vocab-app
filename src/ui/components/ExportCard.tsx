import type { Export } from '../../domain/entities/Export'
import type { Word } from '../../domain/entities/Word'
import { ExportStatus } from '../../domain/values/ExportStatus'
import { WordRow } from './WordRow'

interface ExportCardProps {
  exp: Export
  words: Word[]
  onConfirm: (exp: Export) => Promise<void>
  onFail: (exp: Export) => Promise<void>
  onDelete: (exp: Export) => Promise<void>
}

const statusLabels: Record<string, string> = {
  [ExportStatus.PendingConfirmation]: 'Pending confirmation',
  [ExportStatus.Confirmed]: 'Confirmed',
  [ExportStatus.Failed]: 'Failed',
}

export function ExportCard({ exp, words, onConfirm, onFail, onDelete }: ExportCardProps) {
  const isPending = exp.status === ExportStatus.PendingConfirmation

  return (
    <div className={`export-card export-card--${exp.status}`}>
      <div className="export-card__header">
        <span className={`badge badge--${exp.status}`}>
          {statusLabels[exp.status]}
        </span>
        <span className="export-card__meta">
          {exp.wordCount} word{exp.wordCount !== 1 ? 's' : ''}
          {' \u00b7 '}
          {exp.deckFilter || 'All decks'}
          {' \u00b7 '}
          {exp.createdAt.toLocaleString()}
        </span>
      </div>

      <div className="export-card__words">
        {words.map((w) => (
          <WordRow key={w.id} word={w} />
        ))}
        {words.length < exp.wordCount && (
          <div className="export-card__missing">
            {exp.wordCount - words.length} word{exp.wordCount - words.length !== 1 ? 's' : ''} no longer available
          </div>
        )}
      </div>

      <div className="export-card__actions">
        {isPending && (
          <>
            <button
              className="btn btn--small btn--primary"
              onClick={() => onConfirm(exp)}
            >
              Confirm export
            </button>
            <button
              className="btn btn--small btn--warn"
              onClick={() => onFail(exp)}
            >
              Mark failed
            </button>
          </>
        )}
        <button
          className="btn btn--small btn--danger"
          onClick={() => onDelete(exp)}
        >
          Delete
        </button>
      </div>
    </div>
  )
}
