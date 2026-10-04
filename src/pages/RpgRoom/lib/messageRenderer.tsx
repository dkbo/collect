import React from 'react'

/**
 * 將對話字串的輕量 markup 轉為 ReactNode：
 * - [[kbd:文字]]    → <kbd> 按鍵樣式
 * - [[link:url|文字]] → <a> 外部連結
 * - [[mark:文字]]   → <mark> 重點標記
 */
const TOKEN_RE = /\[\[(kbd|link|mark):([^\]]+)\]\]/g

export function renderMessage(text: string): React.ReactNode {
  if (!TOKEN_RE.test(text)) return text
  TOKEN_RE.lastIndex = 0

  const nodes: React.ReactNode[] = []
  let lastIndex = 0
  let match: RegExpExecArray | null
  let key = 0

  while ((match = TOKEN_RE.exec(text)) !== null) {
    if (match.index > lastIndex) {
      nodes.push(text.slice(lastIndex, match.index))
    }
    const [, type, payload] = match
    if (type === 'kbd') {
      nodes.push(
        <kbd
          key={key++}
          className="rounded-toy-sm border-2 border-line bg-surface-raised px-1.5 font-pixel text-pixel-m text-ink"
        >
          {payload}
        </kbd>
      )
    } else if (type === 'link') {
      const [url, label] = payload.split('|')
      nodes.push(
        <a
          key={key++}
          href={url}
          target="_blank"
          rel="noreferrer"
          className="text-pop underline underline-offset-4"
        >
          {label || url}
        </a>
      )
    } else {
      nodes.push(
        <mark
          key={key++}
          className="rounded-toy-sm bg-pop px-1 text-on-fill"
        >
          {payload}
        </mark>
      )
    }
    lastIndex = match.index + match[0].length
  }

  if (lastIndex < text.length) {
    nodes.push(text.slice(lastIndex))
  }
  return <>{nodes}</>
}

export default renderMessage
