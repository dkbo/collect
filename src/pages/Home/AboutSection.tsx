import { ArrowRight, Sparkles } from 'lucide-react'
import { Link } from 'react-router-dom'

const NOW_ITEMS = [
  { title: '多人對戰', text: '收斂 host 權威與重連流程', dot: 'bg-purple-600' },
  { title: 'AI 協作', text: '用 agent team 跑架構與安全審查', dot: 'bg-indigo-500' },
  { title: 'Side project', text: 'Web3 與量化交易 Bot', dot: 'bg-fuchsia-500' },
] as const

export function AboutSection() {
  return (
    <section className="pb-24" data-testid="home-about">
      <div className="grid grid-cols-1 md:grid-cols-5 gap-5">
        <div className="home-card md:col-span-3 p-8 lg:p-10 flex flex-col gap-4">
          <div className="section-kicker">ABOUT</div>
          <h2 className="section-title text-[26px] md:text-[30px]">關於我</h2>
          <p className="m-0 text-base leading-[1.75] text-slate-600 dark:text-slate-300">
            資深前端工程師，13 年來用 Vue 與 React 做過大型 B2B / B2C 平台、財務系統和 RWD 網頁遊戲，帶過團隊也規劃過架構。近兩年把重心放在 AI 輔助開發：讓 Claude Code 與 Agent 流程真的進到日常產出裡，而不只是 demo。
          </p>
          <Link to="/resume" className="inline-flex items-center gap-1.5 text-sm font-semibold text-purple-600 dark:text-purple-400 hover:text-purple-700 dark:hover:text-purple-300 outline-none focus-visible:ring-2 focus-visible:ring-purple-500 rounded" data-testid="about-resume-link">
            完整經歷看 E-履歷
            <ArrowRight className="w-4 h-4" aria-hidden="true" />
          </Link>
        </div>

        <div className="home-card md:col-span-2 flex flex-col">
          <h3 className="home-card-header text-sm">
            <Sparkles className="w-4 h-4 mr-2 shrink-0" aria-hidden="true" />
            Now
          </h3>
          <ul className="m-0 p-5 list-none flex flex-col gap-3.5">
            {NOW_ITEMS.map((item) => (
              <li key={item.title} className="flex items-start gap-3">
                <span className={`mt-1.5 w-2 h-2 rounded-full shrink-0 ${item.dot}`} aria-hidden="true" />
                <div className="text-sm leading-[1.55] text-slate-700 dark:text-slate-300">
                  <strong className="text-slate-900 dark:text-white">{item.title}</strong> {item.text}
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
