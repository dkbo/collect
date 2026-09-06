import { ArrowUpRight } from 'lucide-react'
import { type CSSProperties, type MouseEvent } from 'react'
import { Link } from 'react-router-dom'
import { cn } from '@/lib/utils'
import { WorkShot } from '@/pages/Home/WorkShot'
import type { Work } from '@/pages/Home/works'

let coarsePointer: boolean | null = null
function isCoarsePointer(): boolean {
  if (coarsePointer === null) {
    coarsePointer =
      typeof window !== 'undefined' &&
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(pointer: coarse)').matches
  }
  return coarsePointer
}

/** 把游標相對位置寫進 CSS 變數，供 .work-card::before 的光暈使用 */
function handleGlow(e: MouseEvent<HTMLAnchorElement>) {
  const rect = e.currentTarget.getBoundingClientRect()
  e.currentTarget.style.setProperty('--mx', `${e.clientX - rect.left}px`)
  e.currentTarget.style.setProperty('--my', `${e.clientY - rect.top}px`)
}

interface WorkCardProps {
  work: Work
  /** 進場 stagger 用，每張延遲 60ms */
  index: number
}

export function WorkCard({ work, index }: WorkCardProps) {
  const enterStyle = { '--delay': `${index * 0.06}s` } as CSSProperties
  const glowProps = isCoarsePointer() ? {} : { onMouseMove: handleGlow }
  const Icon = work.icon

  if (work.variant === 'icon') {
    return (
      <Link
        to={work.to}
        className="work-card work-card-enter p-5 gap-3"
        style={enterStyle}
        data-testid={`work-card-${work.id}`}
        {...glowProps}
      >
        {Icon && (
          <div className="w-10 h-10 rounded-xl bg-purple-500/8 border border-purple-500/15 flex items-center justify-center">
            <Icon className="w-5 h-5 text-purple-600 dark:text-purple-400" aria-hidden="true" />
          </div>
        )}
        <h3 className="m-0 text-base font-bold text-slate-900 dark:text-white">{work.title}</h3>
        <p className="m-0 text-[13px] leading-relaxed text-slate-600 dark:text-slate-300">{work.desc}</p>
        <div className="flex flex-wrap gap-1.5 mt-auto">
          {work.tags.map((t) => <span key={t} className="tag">{t}</span>)}
        </div>
      </Link>
    )
  }

  const featured = work.variant === 'featured'
  return (
    <Link
      to={work.to}
      className={cn('work-card work-card-enter', featured && 'sm:col-span-2 lg:col-span-2')}
      style={enterStyle}
      data-testid={`work-card-${work.id}`}
      {...glowProps}
    >
      <WorkShot work={work} className={featured ? 'h-[220px] lg:h-[250px]' : 'h-[150px] lg:h-[190px]'} />
      {featured && (
        <span className="absolute top-3.5 right-3.5 z-20 px-2.5 py-1 rounded-md text-[11px] font-bold tracking-[0.06em] text-white bg-gradient-to-br from-purple-600 to-indigo-500">
          FEATURED
        </span>
      )}
      <div className={cn('flex flex-col gap-2.5 flex-1', featured ? 'p-6' : 'p-5')}>
        <div className="flex items-center justify-between">
          <h3 className={cn('m-0 font-bold text-slate-900 dark:text-white', featured ? 'text-[22px]' : 'text-[17px]')}>{work.title}</h3>
          <ArrowUpRight className="w-5 h-5 text-purple-600 dark:text-purple-400" aria-hidden="true" />
        </div>
        <p className={cn('m-0 leading-relaxed text-slate-600 dark:text-slate-300', featured ? 'text-sm' : 'text-[13px]')}>{work.desc}</p>
        <div className="flex flex-wrap gap-1.5 mt-auto">
          {work.tags.map((t) => <span key={t} className="tag">{t}</span>)}
        </div>
      </div>
    </Link>
  )
}

export default WorkCard
