export const WordStatus = {
  Pending: 'pending',
  Exported: 'exported',
} as const

export type WordStatus = (typeof WordStatus)[keyof typeof WordStatus]
