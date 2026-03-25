export const Language = {
  EN: 'EN',
  FR: 'FR',
} as const

export type Language = (typeof Language)[keyof typeof Language]
