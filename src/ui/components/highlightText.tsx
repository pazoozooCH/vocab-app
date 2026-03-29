import type { ReactNode } from 'react'

/**
 * Wraps matching substrings in a <mark> element for visual highlighting.
 * Case-insensitive. Returns the original string if no match or empty query.
 */
export function highlightText(text: string, query: string): ReactNode {
  if (!query || query.length < 2) return text

  const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const regex = new RegExp(`(${escaped})`, 'gi')
  const parts = text.split(regex)

  if (parts.length === 1) return text

  return parts.map((part, i) =>
    regex.test(part)
      ? <mark key={i} className="highlight">{part}</mark>
      : part,
  )
}
