import type { ReactNode } from 'react'
import { highlightText } from './highlightText'

export function renderMarkdown(text: string, highlight?: string): ReactNode {
  const tokens = text.split(/(\*\*.+?\*\*|_.+?_)/)
  return tokens.map((token, i) => {
    if (token.startsWith('**') && token.endsWith('**')) {
      return <strong key={i}>{applyHighlight(token.slice(2, -2), highlight)}</strong>
    }
    if (token.startsWith('_') && token.endsWith('_') && !token.startsWith('__')) {
      return <em key={i}>{applyHighlight(token.slice(1, -1), highlight)}</em>
    }
    return <span key={i}>{applyHighlight(token, highlight)}</span>
  })
}

function applyHighlight(text: string, highlight?: string): ReactNode {
  if (!highlight) return text
  return highlightText(text, highlight)
}
