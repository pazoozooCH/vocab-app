export const WordStatus = {
  Pending: 'pending',
  Exported: 'exported',
  Imported: 'imported',
} as const

export type WordStatus = (typeof WordStatus)[keyof typeof WordStatus]
