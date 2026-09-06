import { ArrowUpRight, ChevronRight } from 'lucide-react'
import { lazy, Suspense, useState, type SyntheticEvent } from 'react'
import { cn } from '@/lib/utils'
import { JOURNEY, type JourneyItem, type JourneySnippet } from '@/pages/Home/journey'

const CodeSnippet = lazy(() => import('@/pages/Home/CodeSnippet'))

function SnippetDetails({ snippet }: { snippet: JourneySnippet }) {
  const [open, setOpen] = useState(false)
  const onToggle = (e: SyntheticEvent<HTMLDetailsElement>) => setOpen(e.currentTarget.open)
  return (
    <details onToggle={onToggle} className="group">
      <summary className="cursor-pointer list-none inline-flex items-center gap-1.5 text-[13px] font-semibold text-purple-600 dark:text-purple-400 hover:text-purple-700 dark:hover:text-purple-300 outline-none focus-visible:ring-2 focus-visible:ring-purple-500 rounded">
        <ChevronRight className="w-3.5 h-3.5 transition-transform group-open:rotate-90" aria-hidden="true" />
        {snippet.summary}
      </summary>
      <div className="mt-3">
        {open && (
          <Suspense fallback={<div className="h-40 rounded-xl bg-slate-200 dark:bg-slate-800 animate-pulse" aria-hidden="true" />}>
            <CodeSnippet language={snippet.language} code={snippet.code} />
          </Suspense>
        )}
      </div>
    </details>
  )
}

function JourneyNode({ item, isLast }: { item: JourneyItem; isLast: boolean }) {
  return (
    <div className={cn('grid grid-cols-[28px_minmax(0,1fr)] md:grid-cols-[110px_40px_minmax(0,1fr)]', !isLast && 'pb-9')}>
      <div className={cn('hidden md:block text-right pr-2 pt-0.5 text-sm font-bold', item.current ? 'text-purple-600 dark:text-purple-400' : 'text-slate-900 dark:text-white')}>
        {item.year}
      </div>
      <div className="flex justify-center md:justify-center pt-1 animate-on-scroll animate-scale-in">
        <span className={item.current ? 'journey-dot-current' : 'journey-dot'} aria-hidden="true" />
      </div>
      <div className="flex flex-col gap-2.5 pl-2">
        <div className={cn('md:hidden text-xs font-bold', item.current ? 'text-purple-600 dark:text-purple-400' : 'text-indigo-500')}>{item.year}</div>
        <h3 className="m-0 text-lg font-bold text-slate-900 dark:text-white">{item.title}</h3>
        <p className="m-0 text-sm leading-[1.65] text-slate-600 dark:text-slate-300">{item.body}</p>

        {item.lessons && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {item.lessons.map((l) => (
              <div key={l.label} className="home-card p-4 flex flex-col gap-1">
                <div className="text-[11px] font-bold tracking-[0.08em] text-slate-400">{l.label}</div>
                <div className="text-[13px] leading-normal text-slate-700 dark:text-slate-300">{l.text}</div>
              </div>
            ))}
          </div>
        )}

        {(item.snippet || item.links) && (
          <div className="flex flex-wrap items-start gap-4">
            {item.snippet && <SnippetDetails snippet={item.snippet} />}
            {item.links?.map((link) => (
              <a
                key={link.href}
                href={link.href}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-purple-600 dark:text-purple-400 hover:text-purple-700 dark:hover:text-purple-300 outline-none focus-visible:ring-2 focus-visible:ring-purple-500 rounded"
                data-testid={link.testId}
              >
                <ArrowUpRight className="w-3.5 h-3.5" aria-hidden="true" />
                {link.label}
              </a>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

export function JourneySection() {
  return (
    <section className="pb-24 flex flex-col gap-9" data-testid="home-journey">
      <div className="flex flex-col gap-2">
        <div className="section-kicker">JOURNEY</div>
        <h2 className="section-title">開發歷程</h2>
      </div>
      <div className="relative">
        <div className="journey-line left-[13px] md:left-[129px] top-2 bottom-2" aria-hidden="true" />
        {JOURNEY.map((item, i) => (
          <JourneyNode key={item.year} item={item} isLast={i === JOURNEY.length - 1} />
        ))}
      </div>
    </section>
  )
}

export default JourneySection
