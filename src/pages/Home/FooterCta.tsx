import { ArrowUpRight } from 'lucide-react'
import { Button, CtaPanel } from '@/components/toybox'

const GITHUB_URL = 'https://github.com/dkbo/collect'
const BLOG_URL = 'https://dkbo-blog.github.io'
const CODEPEN_URL = 'https://codepen.io/dkbo/pen/vOvWox?editors=0010'

function GithubIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M12 0C5.374 0 0 5.373 0 12c0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23A11.509 11.509 0 0 1 12 5.803c1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576C20.566 21.797 24 17.3 24 12c0-6.627-5.373-12-12-12z" />
    </svg>
  )
}

const ARROW = <ArrowUpRight strokeWidth={2.5} aria-hidden="true" />

export function FooterCta() {
  return (
    <section className="home-cta" data-testid="home-footer">
      <CtaPanel
        eyebrow="CONTINUE? 10 … 9 … 8"
        title="程式碼全部公開"
        body="這個站本身也是作品之一。想看實作細節或聊聊 AI 協作開發，都歡迎。"
      >
        <Button variant="pop" href={GITHUB_URL} icon={<GithubIcon />} data-testid="github-link">
          GitHub
        </Button>
        <Button href={BLOG_URL} iconEnd={ARROW} data-testid="blog-link">
          Blog
        </Button>
        <Button href={CODEPEN_URL} iconEnd={ARROW} data-testid="codepen-footer-link">
          Codepen
        </Button>
      </CtaPanel>
    </section>
  )
}

export default FooterCta
