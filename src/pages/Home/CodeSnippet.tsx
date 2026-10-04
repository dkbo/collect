import { Light as SyntaxHighlighter } from 'react-syntax-highlighter'
import javascript from 'react-syntax-highlighter/dist/esm/languages/hljs/javascript'
import xml from 'react-syntax-highlighter/dist/esm/languages/hljs/xml'
import { monokai } from 'react-syntax-highlighter/dist/esm/styles/hljs'
import type { SnippetLanguage } from '@/pages/Home/journey'

// Light 版只帶註冊過的語言（預設版會打包 hljs 全部語言，約 885 KB）
SyntaxHighlighter.registerLanguage('html', xml)
SyntaxHighlighter.registerLanguage('javascript', javascript)

interface CodeSnippetProps {
  language: SnippetLanguage
  code: string
}

const LABEL: Record<SnippetLanguage, string> = { html: 'HTML', javascript: 'JAVASCRIPT' }

/** 只在 <details> 展開後由 React.lazy 載入 */
export default function CodeSnippet({ language, code }: CodeSnippetProps) {
  return (
    <div className="home-code">
      <div className="home-code__bar">
        <span className="text-pop">SOURCE</span>
        <span className="text-on-inverse-muted">{LABEL[language]}</span>
      </div>
      <SyntaxHighlighter
        language={language}
        style={monokai}
        showLineNumbers
        wrapLongLines
        customStyle={{
          margin: 0,
          padding: '0.75rem',
          fontSize: '0.85rem',
          lineHeight: '1.6',
          background: 'transparent',
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-word',
        }}
      >
        {code}
      </SyntaxHighlighter>
    </div>
  )
}
