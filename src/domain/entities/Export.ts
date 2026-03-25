import type { ExportStatus } from '../values/ExportStatus'

interface ExportProps {
  id: string
  userId: string
  status: ExportStatus
  wordIds: string[]
  deckFilter: string
  wordCount: number
  createdAt: Date
}

export class Export {
  readonly id: string
  readonly userId: string
  readonly status: ExportStatus
  readonly wordIds: readonly string[]
  readonly deckFilter: string
  readonly wordCount: number
  readonly createdAt: Date

  private constructor(props: ExportProps) {
    this.id = props.id
    this.userId = props.userId
    this.status = props.status
    this.wordIds = [...props.wordIds]
    this.deckFilter = props.deckFilter
    this.wordCount = props.wordCount
    this.createdAt = props.createdAt
  }

  static create(props: ExportProps): Export {
    if (props.wordIds.length === 0) {
      throw new Error('Export must contain at least one word')
    }
    return new Export(props)
  }

  withStatus(status: ExportStatus): Export {
    return new Export({
      id: this.id,
      userId: this.userId,
      status,
      wordIds: [...this.wordIds],
      deckFilter: this.deckFilter,
      wordCount: this.wordCount,
      createdAt: this.createdAt,
    })
  }
}
