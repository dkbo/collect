const SKILL_ITEMS = [
  // 核心框架與語言
  { text: 'Vue2 / Vue3', weight: 6 },
  { text: 'React', weight: 6 },
  { text: 'TypeScript', weight: 6 },
  { text: 'JavaScript (ES6+)', weight: 6 },
  // 框架生態與工程化
  { text: 'Nuxt.js', weight: 4 },
  { text: 'Next.js', weight: 4 },
  { text: 'Pinia', weight: 4 },
  { text: 'Vuex', weight: 4 },
  { text: 'TailwindCSS', weight: 4 },
  { text: 'Vite', weight: 4 },
  { text: 'Webpack', weight: 4 },
  { text: 'Node.js', weight: 4 },
  { text: 'SSR / SPA', weight: 4 },
  { text: 'Micro Frontend', weight: 4 },
  // AI 協作工具
  { text: 'Claude Code', weight: 6 },
  { text: 'AI Agent Workflow', weight: 4 },
  { text: 'Prompt Engineering', weight: 4 },
  { text: 'Codex CLI', weight: 3 },
  { text: 'Vibe Coding', weight: 3 },
  // 基礎與工具鏈
  { text: 'HTML', weight: 3 },
  { text: 'CSS / Sass', weight: 3 },
  { text: 'Headless UI', weight: 3 },
  { text: 'Docker', weight: 3 },
  { text: 'Nginx', weight: 3 },
  { text: 'Git', weight: 3 },
  { text: 'ESLint', weight: 3 },
  { text: 'Azure DevOps CI/CD', weight: 3 },
  { text: 'WSL2 / Linux', weight: 3 },
  { text: '效能優化', weight: 3 },
]

export function SkillSection() {
  return (
    <section className="resume-card" data-testid="resume-skills">
      <h2 className="resume-card-header">技能</h2>
      <div className="p-6 md:p-8">
        <div className="flex flex-wrap justify-center items-center gap-2 md:gap-3">
          {SKILL_ITEMS.map((item, idx) => {
            const sizeClass = 
              item.weight === 6
                ? 'text-base sm:text-lg md:text-xl px-3.5 py-1.5 font-extrabold'
                : item.weight === 4
                  ? 'text-xs sm:text-sm md:text-base px-3 py-1 font-bold'
                  : 'text-[11px] sm:text-xs md:text-sm px-2.5 py-0.5 font-medium'

            const colorClass = 
              item.weight === 6
                ? 'bg-purple-500/10 text-purple-700 dark:text-purple-300 border-purple-500/30'
                : item.weight === 4
                  ? 'bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 border-indigo-500/20'
                  : 'bg-slate-500/10 text-slate-600 dark:text-slate-400 border-slate-500/15'

            return (
              <span
                key={idx}
                className={`inline-block border rounded-full transition-all duration-300 transform hover:scale-110 hover:-translate-y-0.5 hover:shadow-md cursor-default select-none ${sizeClass} ${colorClass}`}
                data-testid={`skill-tag-${item.text}`}
              >
                {item.text}
              </span>
            )
          })}
        </div>
      </div>
    </section>
  )
}

export default SkillSection
