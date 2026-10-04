import { ArrowRight } from 'lucide-react'
import { Button, SectionHeader } from '@/components/toybox'

const NOW_ITEMS = [
  { title: '多人對戰', text: '收斂 host 權威與重連流程', dot: 'bg-sky' },
  { title: 'AI 協作', text: '用 agent team 跑架構與安全審查', dot: 'bg-mint' },
  { title: 'Side project', text: 'Web3 與量化交易 Bot', dot: 'bg-pink' },
] as const

export function AboutSection() {
  return (
    <section className="home-about" data-testid="home-about">
      <SectionHeader eyebrow="— ABOUT —" title="關於我" />
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        <div className="home-about-card">
          <p className="m-0 text-body-l text-ink">
            資深前端工程師，13 年來用 Vue 與 React 做過大型 B2B / B2C 平台、財務系統和 RWD 網頁遊戲，帶過團隊也規劃過架構。近兩年把重心放在 AI 輔助開發：讓 Claude Code 與 Agent 流程真的進到日常產出裡，而不只是 demo。
          </p>
          <Button href="/resume" size="s" iconEnd={<ArrowRight strokeWidth={2.5} aria-hidden="true" />} data-testid="about-resume-link">
            完整經歷看 E-履歷
          </Button>
        </div>

        <div className="home-now">
          <h3 className="home-now__strip">NOW PLAYING</h3>
          <ul className="m-0 flex list-none flex-col gap-4 p-5">
            {NOW_ITEMS.map((item) => (
              <li key={item.title} className="flex items-start gap-3">
                <span className={`home-now__dot ${item.dot}`} aria-hidden="true" />
                <div className="text-body-s text-ink-muted">
                  <strong className="text-ink">{item.title}</strong> {item.text}
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  )
}

export default AboutSection
