import { User, Code2, Bot, Layers, Gamepad2 } from 'lucide-react'

const SKILL_TAGS = [
  { label: 'Vue', icon: Code2 },
  { label: 'React', icon: Code2 },
  { label: 'TypeScript', icon: Code2 },
  { label: 'AI 協作開發', icon: Bot },
  { label: '網頁遊戲', icon: Gamepad2 },
  { label: 'Web3', icon: Layers },
] as const

export function IntroSection() {
  return (
    <section
      className="home-card group"
      data-testid="home-intro"
    >
      <h2 className="home-card-header">
        <User className="w-5 h-5 mr-2 shrink-0" aria-hidden="true" />
        簡介
      </h2>

      <div className="p-6 md:p-8">
        <p className="text-slate-600 dark:text-slate-300 leading-relaxed text-sm md:text-base">
          擁有 13+ 年經驗的資深前端工程師，以 Vue 及 React 開發過大型 B2B / B2C 平台、財務系統與 RWD 網頁遊戲等專案，並具備前端架構規劃、效能優化與團隊技術帶領經驗。近年深耕 AI 輔助開發流程（Claude Code、AI Agent Workflow、Vibe Coding），同時持續在 Web3、自動化 Bot 與量化交易等領域實作 Side Project，目標是運用新技術打造更多有趣且有意義的產品。
        </p>

        {/* Skill Tags */}
        <div className="flex flex-wrap gap-2 mt-5">
          {SKILL_TAGS.map(({ label, icon: Icon }) => (
            <span
              key={label}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-purple-500/5 dark:bg-purple-500/10 text-purple-700 dark:text-purple-300 border border-purple-500/15 dark:border-purple-500/20 transition-colors duration-200 cursor-default"
            >
              <Icon className="w-3 h-3" aria-hidden="true" />
              {label}
            </span>
          ))}
        </div>
      </div>
    </section>
  )
}

export default IntroSection
