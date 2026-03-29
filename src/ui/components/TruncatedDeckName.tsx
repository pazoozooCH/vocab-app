import { useState } from 'react'

function truncateMiddle(name: string, maxLen: number): string {
  if (name.length <= maxLen) return name

  const parts = name.split('::')
  if (parts.length <= 2) {
    // Simple truncation for non-hierarchical or shallow names
    const half = Math.floor((maxLen - 3) / 2)
    return name.slice(0, half) + '…' + name.slice(-half)
  }

  // Keep first and last parts, replace middle with …
  const first = parts[0]
  const last = parts[parts.length - 1]
  const combined = `${first}::…::${last}`
  if (combined.length <= maxLen) return combined

  // If still too long, truncate the last part
  const available = maxLen - first.length - 6 // "::…::" = 5 + 1 for safety
  if (available > 3) return `${first}::…::${last.slice(0, available)}…`
  return name.slice(0, maxLen - 1) + '…'
}

interface TruncatedDeckNameProps {
  name: string
  maxLen?: number
}

export function TruncatedDeckName({ name, maxLen = 25 }: TruncatedDeckNameProps) {
  const [showFull, setShowFull] = useState(false)
  const truncated = truncateMiddle(name, maxLen)
  const isTruncated = truncated !== name

  return (
    <span
      className="word-card__deck"
      title={name}
      onClick={isTruncated ? () => setShowFull((v) => !v) : undefined}
      style={isTruncated ? { cursor: 'pointer' } : undefined}
    >
      {showFull ? name : truncated}
    </span>
  )
}
