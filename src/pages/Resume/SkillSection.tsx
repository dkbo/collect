const SKILL_ITEMS = [
  { text: 'HTML', weight: 6 },
  { text: 'Javascript', weight: 6 },
  { text: 'ES6', weight: 6 },
  { text: 'CSS', weight: 6 },
  { text: 'sass', weight: 4 },
  { text: 'pug', weight: 4 },
  { text: 'babel', weight: 4 },
  { text: 'gulp', weight: 4 },
  { text: 'webpack', weight: 4 },
  { text: 'Virtual Studio Code', weight: 3 },
  { text: 'Wordpress', weight: 3 },
  { text: 'Joomla', weight: 3 },
  { text: 'Hexo', weight: 3 },
  { text: 'GitHub', weight: 3 },
  { text: 'Firebase', weight: 3 },
  { text: 'Heroku', weight: 3 },
  { text: 'jQuery', weight: 4 },
  { text: 'Socket.io', weight: 4 },
  { text: 'Bootstrap', weight: 4 },
  { text: 'React', weight: 4 },
  { text: 'Vue', weight: 4 },
  { text: 'Express', weight: 3 },
  { text: 'Koa', weight: 3 },
  { text: 'Node', weight: 3 },
  { text: 'PHP', weight: 3 },
  { text: 'Jest', weight: 3 },
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
