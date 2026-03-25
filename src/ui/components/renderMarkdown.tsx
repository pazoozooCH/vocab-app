export function renderMarkdown(text: string) {
  const tokens = text.split(/(\*\*.+?\*\*|_.+?_)/)
  return tokens.map((token, i) => {
    if (token.startsWith('**') && token.endsWith('**')) {
      return <strong key={i}>{token.slice(2, -2)}</strong>
    }
    if (token.startsWith('_') && token.endsWith('_') && !token.startsWith('__')) {
      return <em key={i}>{token.slice(1, -1)}</em>
    }
    return token
  })
}
