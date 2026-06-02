import { User, Code2, Globe, Layers } from 'lucide-react'

const SKILL_TAGS = [
  { label: 'Vue', icon: Code2 },
  { label: 'React', icon: Code2 },
  { label: 'WebVR', icon: Globe },
  { label: 'WebAR', icon: Globe },
  { label: '區塊鏈', icon: Layers },
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
          資深前端工程師，用 Vue 及 React 開發過大大小小的專案，未來會想朝著區塊鍊及元宇宙 WebVR WebAR發展，開發更多有趣及有意義的項目。
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
