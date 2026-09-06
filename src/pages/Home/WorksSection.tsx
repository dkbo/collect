import { ChevronRight } from 'lucide-react'
import { useState, type CSSProperties } from 'react'
import { Link } from 'react-router-dom'
import { cn } from '@/lib/utils'
import { WorkCard } from '@/pages/Home/WorkCard'
import { WORKS, type Work, type WorkKind } from '@/pages/Home/works'

type Filter = 'all' | WorkKind

const FILTERS: readonly { id: Filter; label: string }[] = [
  { id: 'all', label: '全部' },
  { id: 'game', label: '遊戲' },
  { id: 'tool', label: '工具' },
]

/** lg 以下工具卡改成清單列 */
function ToolList({ tools }: { tools: readonly Work[] }) {
  return (
    <div className="home-card work-card-enter divide-y divide-slate-200 dark:divide-slate-800" style={{ '--delay': '0.3s' } as CSSProperties}>
      {tools.map((work) => {
        const Icon = work.icon
        return (
          <Link
            key={work.id}
            to={work.to}
            className="flex items-center gap-3.5 px-4 py-3.5 no-underline outline-none focus-visible:ring-2 focus-visible:ring-purple-500"
            data-testid={`work-list-${work.id}`}
          >
            <div className="w-10 h-10 rounded-xl bg-purple-500/8 border border-purple-500/15 flex items-center justify-center shrink-0">
              {Icon && <Icon className="w-[18px] h-[18px] text-purple-600 dark:text-purple-400" aria-hidden="true" />}
            </div>
            <div className="flex flex-col gap-0.5 flex-1 min-w-0">
              <div className="text-[15px] font-bold text-slate-900 dark:text-white">{work.title}</div>
              <div className="text-xs text-slate-500 dark:text-slate-400 truncate">{work.desc}</div>
            </div>
            <ChevronRight className="w-4 h-4 text-slate-400 shrink-0" aria-hidden="true" />
          </Link>
        )
      })}
    </div>
  )
}

export function WorksSection() {
  const [filter, setFilter] = useState<Filter>('all')
  const games = WORKS.filter((w) => w.kind === 'game')
  const tools = WORKS.filter((w) => w.kind === 'tool')
  const showGames = filter !== 'tool'
  const showTools = filter !== 'game'

  return (
    <section id="works" className="scroll-mt-24 pb-24 flex flex-col gap-7" data-testid="home-works">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div className="flex flex-col gap-2">
          <div className="section-kicker">WORKS</div>
          <h2 className="section-title">作品</h2>
        </div>
        <div className="inline-flex self-start gap-1.5 p-1 rounded-xl bg-slate-100/90 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 text-[13px] font-semibold" role="tablist" aria-label="作品分類">
          {FILTERS.map((f) => (
            <button
              key={f.id}
              type="button"
              role="tab"
              aria-selected={filter === f.id}
              onClick={() => setFilter(f.id)}
              data-testid={`works-filter-${f.id}`}
              className={cn(
                'px-3.5 py-1.5 rounded-[9px] transition-colors outline-none focus-visible:ring-2 focus-visible:ring-purple-500',
                filter === f.id
                  ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white',
              )}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      <div key={filter} className="flex flex-col gap-5">
        {showGames && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {games.map((work, i) => <WorkCard key={work.id} work={work} index={i} />)}
          </div>
        )}
        {showTools && (
          <>
            <div className="hidden lg:grid grid-cols-4 gap-5">
              {tools.map((work, i) => <WorkCard key={work.id} work={work} index={games.length + i} />)}
            </div>
            <div className="lg:hidden">
              <ToolList tools={tools} />
            </div>
          </>
        )}
      </div>
    </section>
  )
}

export default WorksSection
