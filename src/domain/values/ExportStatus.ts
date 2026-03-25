export const ExportStatus = {
  PendingConfirmation: 'pending_confirmation',
  Confirmed: 'confirmed',
  Failed: 'failed',
} as const

export type ExportStatus = (typeof ExportStatus)[keyof typeof ExportStatus]
