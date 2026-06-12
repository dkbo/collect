

import SyntaxHighlighter from 'react-syntax-highlighter'
import { monokai } from 'react-syntax-highlighter/dist/esm/styles/hljs'

function GithubIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      className={className}
      aria-hidden="true"
    >
      <path d="M12 0C5.374 0 0 5.373 0 12c0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23A11.509 11.509 0 0 1 12 5.803c1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576C20.566 21.797 24 17.3 24 12c0-6.627-5.373-12-12-12z" />
    </svg>
  )
}


const CODE_HIGHLIGHT = `/**
 * @作者 DKBO
 * @Blog https://dkbo-blog.github.io
 * @LICENSE MIT
 * @returns {作品} Me
 */

<div className="col col-md-6">
  <div className="card">
    <img className="card-img-top" src={head} style={{ width: '100%' }} />
  </div>
</div>
<div className="col col-md-6">
  <div className="hidden-md-down">
    <div className="h1">
      <a href="https://github.com/dkbo/collect">
        <i className="fa fa-github"></i>
      </a>
      大家好我是<code>DKBO</code>
    </div>
    <hr />
  </div>
  <div>
    <div className="h2">
      <a href="https://github.com/dkbo/collect">
        <i className="fa fa-github"></i>
      </a>
      大家好我是<code>DKBO</code>
    </div>
    <hr />
  </div>
  <div className="hidden-sm-down">
    <div className="h3">
      <a href="https://github.com/dkbo/collect">
        <i className="fa fa-github"></i>
      </a>
      大家好我是<code>DKBO</code>
    </div>
    <hr />
  </div>
  <div className="hidden-sm-down">
    <div className="h4">
      <a href="https://github.com/dkbo/collect">
        <i className="fa fa-github"></i>
      </a>
      大家好我是<code>DKBO</code>
    </div>
    <hr />
  </div>
  <div className="hidden-sm-down">
    <div className="h5">
      <a href="https://github.com/dkbo/collect">
        <i className="fa fa-github"></i>
      </a>
      大家好我是<code>DKBO</code>
    </div>
    <hr />
  </div>
  <div className="hidden-sm-down">
    <div className="h6">
      <a href="https://github.com/dkbo/collect">
        <i className="fa fa-github"></i>
      </a>
      大家好我是<code>DKBO</code>
    </div>
  </div>
</div>`

const HEADING_SIZES = [
  { label: 'h1', className: 'text-4xl md:text-5xl font-extrabold', hideOnMobile: false },
  { label: 'h2', className: 'text-3xl md:text-4xl font-bold', hideOnMobile: false },
  { label: 'h3', className: 'text-2xl md:text-3xl font-bold', hideOnMobile: true },
  { label: 'h4', className: 'text-xl md:text-2xl font-semibold', hideOnMobile: true },
  { label: 'h5', className: 'text-lg md:text-xl font-semibold', hideOnMobile: true },
  { label: 'h6', className: 'text-base md:text-lg font-medium', hideOnMobile: true },
] as const

export function PastSection() {
  return (
    <section
      className="home-card group"
      data-testid="home-past"
    >
      <h2 className="home-card-header">
        10幾年前(過去式)
      </h2>

      <div className="p-6 md:p-8 space-y-8">
        {/* Image + Heading Cascade */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8">
          {/* Background Image Card */}
          <div className="relative overflow-hidden rounded-xl border border-slate-200 dark:border-slate-800 aspect-video group/img shadow-md transition-all duration-300">
            <img
              src={`${import.meta.env.BASE_URL}aboutbg.webp`}
              alt="Developer workspace showing VS Code editor"
              className="w-full h-full object-cover transition-transform duration-500 group-hover/img:scale-105"
              data-testid="about-bg-image"
              loading="lazy"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent pointer-events-none" />
          </div>

          {/* Heading Cascade */}
          <div className="flex flex-col justify-center space-y-3">
            {HEADING_SIZES.map(({ label, className, hideOnMobile }) => (
              <div
                key={label}
                className={`group/heading ${hideOnMobile ? 'hidden md:block' : ''}`}
              >
                <div className={`${className} text-slate-800 dark:text-slate-200 flex items-center gap-2 transition-colors duration-300`}>
                  <a
                    href="https://github.com/dkbo/collect"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-purple-600 hover:text-purple-500 dark:text-purple-400 dark:hover:text-purple-300 transition-colors shrink-0 outline-none focus-visible:ring-2 focus-visible:ring-purple-500 rounded-md p-1"
                    aria-label={`GitHub ${label} 連結`}
                    data-testid={`github-link-${label}`}
                  >
                    <GithubIcon className="w-5 h-5" />
                  </a>
                  <span>
                    大家好我是
                    <code className="home-inline-code ml-1">DKBO</code>
                  </span>
                </div>
                <div className="h-px bg-gradient-to-r from-purple-500/40 via-indigo-500/20 to-transparent mt-2" />
              </div>
            ))}
          </div>
        </div>

        {/* Code Block */}
        <div className="relative overflow-hidden rounded-xl border border-slate-200 dark:border-slate-800 shadow-md">
          <div className="absolute top-3 right-3 px-2 py-0.5 rounded text-[10px] font-mono text-slate-500 dark:text-slate-400 bg-slate-200/80 dark:bg-slate-800/80 border border-slate-300 dark:border-slate-700/50 select-none z-10">
            HTML
          </div>
          <SyntaxHighlighter
            language="html"
            style={monokai}
            showLineNumbers
            wrapLongLines={true}
            customStyle={{
              margin: 0,
              padding: '1.25rem',
              fontSize: '0.85rem',
              lineHeight: '1.6',
              background: '#272822',
              overflowY: 'hidden',
              height: 'auto',
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
            }}
          >
            {CODE_HIGHLIGHT}
          </SyntaxHighlighter>
        </div>
      </div>
    </section>
  )
}

export default PastSection
