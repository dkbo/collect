import SyntaxHighlighter from 'react-syntax-highlighter'
import { monokai } from 'react-syntax-highlighter/dist/esm/styles/hljs'
import type { SnippetLanguage } from '@/pages/Home/journey'

interface CodeSnippetProps {
  language: SnippetLanguage
  code: string
}

const LABEL: Record<SnippetLanguage, string> = { html: 'HTML', javascript: 'JavaScript' }

/** 只在 <details> 展開後由 React.lazy 載入 */
export default function CodeSnippet({ language, code }: CodeSnippetProps) {
  return (
    <div className="relative overflow-hidden rounded-xl border border-slate-200 dark:border-slate-800 shadow-md">
      <div className="absolute top-3 right-3 z-10 px-2 py-0.5 rounded text-[10px] font-mono text-slate-400 bg-slate-800/80 border border-slate-700/50 select-none">
        {LABEL[language]}
      </div>
      <SyntaxHighlighter
        language={language}
        style={monokai}
        showLineNumbers
        wrapLongLines
        customStyle={{
          margin: 0,
          padding: '1.25rem',
          fontSize: '0.85rem',
          lineHeight: '1.6',
          background: '#272822',
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-word',
        }}
      >
        {code}
      </SyntaxHighlighter>
    </div>
  )
}
