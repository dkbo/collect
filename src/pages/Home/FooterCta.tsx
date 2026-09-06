const GITHUB_URL = 'https://github.com/dkbo/collect'
const BLOG_URL = 'https://dkbo-blog.github.io'
const CODEPEN_URL = 'https://codepen.io/dkbo/pen/vOvWox?editors=0010'

function GithubIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
      <path d="M12 0C5.374 0 0 5.373 0 12c0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23A11.509 11.509 0 0 1 12 5.803c1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576C20.566 21.797 24 17.3 24 12c0-6.627-5.373-12-12-12z" />
    </svg>
  )
}

const GHOST_BTN =
  'flex-1 md:flex-none inline-flex items-center justify-center gap-2 h-[46px] px-5 rounded-xl bg-white/12 border border-white/30 text-white text-sm font-bold hover:bg-white/20 transition-colors outline-none focus-visible:ring-2 focus-visible:ring-white'

export function FooterCta() {
  return (
    <section className="pb-20" data-testid="home-footer">
      <div className="footer-cta p-8 md:px-14 md:py-12 flex flex-col md:flex-row md:items-center md:justify-between gap-6">
        <div className="absolute -right-20 -top-28 w-80 h-80 rounded-full bg-white/8 blur-[40px] pointer-events-none" aria-hidden="true" />
        <div className="relative flex flex-col gap-2">
          <h2 className="m-0 text-2xl md:text-[30px] font-extrabold tracking-tight">程式碼全部公開</h2>
          <p className="m-0 text-[15px] leading-relaxed text-white/80 max-w-[520px]">這個站本身也是作品之一。想看實作細節或聊聊 AI 協作開發，都歡迎。</p>
        </div>
        <div className="relative flex gap-3 shrink-0">
          <a href={GITHUB_URL} target="_blank" rel="noopener noreferrer" data-testid="github-link"
            className="flex-1 md:flex-none inline-flex items-center justify-center gap-2 h-[46px] px-5 rounded-xl bg-white text-purple-950 text-sm font-bold hover:bg-purple-50 transition-colors outline-none focus-visible:ring-2 focus-visible:ring-white">
            <GithubIcon className="w-[18px] h-[18px]" />
            GitHub
          </a>
          <a href={BLOG_URL} target="_blank" rel="noopener noreferrer" className={GHOST_BTN} data-testid="blog-link">Blog</a>
          <a href={CODEPEN_URL} target="_blank" rel="noopener noreferrer" className={GHOST_BTN} data-testid="codepen-footer-link">Codepen</a>
        </div>
      </div>
    </section>
  )
}

export default FooterCta
