import { useState, useEffect } from 'react'

function formatRelative(date: Date): { text: string; refreshIn: number } {
  const now = Date.now()
  const diff = now - date.getTime()
  const seconds = Math.floor(diff / 1000)
  const minutes = Math.floor(seconds / 60)
  const hours = Math.floor(minutes / 60)
  const days = Math.floor(hours / 24)

  if (seconds < 30) return { text: 'just now', refreshIn: 30_000 - diff }
  if (seconds < 60) return { text: `${seconds}s ago`, refreshIn: 1_000 }
  if (minutes < 60) return { text: `${minutes}m ago`, refreshIn: 60_000 }
  if (hours < 24) return { text: `${hours}h ago`, refreshIn: 3_600_000 }
  if (days === 1) return { text: 'yesterday', refreshIn: 3_600_000 }
  if (days < 30) return { text: `${days}d ago`, refreshIn: 3_600_000 }
  return { text: date.toLocaleDateString(), refreshIn: 86_400_000 }
}

interface RelativeTimeProps {
  date: Date
}

export function RelativeTime({ date }: RelativeTimeProps) {
  const [, setTick] = useState(0)

  useEffect(() => {
    const { refreshIn } = formatRelative(date)
    const timer = setTimeout(() => setTick((t) => t + 1), Math.max(refreshIn, 1000))
    return () => clearTimeout(timer)
  })

  const { text } = formatRelative(date)
  return <span title={date.toLocaleString()}>{text}</span>
}
