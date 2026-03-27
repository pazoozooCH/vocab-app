// Simple navigation guard: AddWordPage sets a guard message,
// Layout checks it before navigating away.

let guardMessage: string | null = null

export function setNavigationGuard(message: string | null) {
  guardMessage = message
}

export function getNavigationGuard(): string | null {
  return guardMessage
}

export function checkNavigationGuard(): boolean {
  if (!guardMessage) return true
  return confirm(guardMessage)
}
