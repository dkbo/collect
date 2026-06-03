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
          className="bg-slate-700 text-slate-100 dark:bg-slate-200 dark:text-slate-900 px-2 py-0.5 rounded text-xs font-mono shadow-sm font-semibold"
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
          className="text-purple-500 hover:text-purple-400 font-semibold underline underline-offset-4"
        >
          {label || url}
        </a>
      )
    } else {
      nodes.push(
        <mark
          key={key++}
          className="bg-purple-200 text-purple-950 dark:bg-purple-900/60 dark:text-purple-100 px-1 rounded font-bold"
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
