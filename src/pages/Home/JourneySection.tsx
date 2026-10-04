import { ArrowUpRight, ChevronRight } from 'lucide-react'
import { lazy, Suspense, useState, type SyntheticEvent } from 'react'
import { Button, SectionHeader, tbCn } from '@/components/toybox'
import { JOURNEY, type JourneyItem, type JourneySnippet } from '@/pages/Home/journey'

const CodeSnippet = lazy(() => import('@/pages/Home/CodeSnippet'))

function SnippetDetails({ snippet }: { snippet: JourneySnippet }) {
  const [open, setOpen] = useState(false)
  const onToggle = (e: SyntheticEvent<HTMLDetailsElement>) => setOpen(e.currentTarget.open)
  return (
    <details onToggle={onToggle} className="group w-full">
      <summary className="home-journey__summary tb-lift-s">
        <ChevronRight strokeWidth={2.5} className="size-4 transition-transform group-open:rotate-90 motion-reduce:transition-none" aria-hidden="true" />
        {snippet.summary}
      </summary>
      <div className="mt-4">
        {open && (
          <Suspense fallback={<div className="home-journey__loading" aria-hidden="true">LOADING</div>}>
            <CodeSnippet language={snippet.language} code={snippet.code} />
          </Suspense>
        )}
      </div>
    </details>
  )
}

function JourneyNode({ item, isLast }: { item: JourneyItem; isLast: boolean }) {
  return (
    <div className={tbCn('grid grid-cols-[28px_minmax(0,1fr)] md:grid-cols-[112px_40px_minmax(0,1fr)]', !isLast && 'pb-10')}>
      <div className={tbCn('hidden md:block pr-2 text-right font-pixel text-pixel-m', item.current ? 'text-ink' : 'text-ink-muted')}>
        {item.year}
      </div>
      <div className="flex justify-center pt-1">
        <span className={tbCn('home-journey__dot', item.current && 'home-journey__dot--current')} aria-hidden="true" />
      </div>
      <div className="flex min-w-0 flex-col gap-3 pl-2">
        <div className={tbCn('font-pixel text-pixel-m md:hidden', item.current ? 'text-ink' : 'text-ink-muted')}>{item.year}</div>
        <h3 className="m-0 text-heading-m text-ink">{item.title}</h3>
        <p className="m-0 text-body text-ink-muted">{item.body}</p>

        {item.lessons && (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            {item.lessons.map((l) => (
              <div key={l.label} className="home-journey__lesson">
                <div className="text-caption text-ink-muted">{l.label}</div>
                <div className="text-body-s text-ink">{l.text}</div>
              </div>
            ))}
          </div>
        )}

        {(item.snippet || item.links) && (
          <div className="flex flex-wrap items-start gap-4">
            {item.snippet && <SnippetDetails snippet={item.snippet} />}
            {item.links?.map((link) => (
              <Button
                key={link.href}
                href={link.href}
                size="s"
                icon={<ArrowUpRight strokeWidth={2.5} aria-hidden="true" />}
                data-testid={link.testId}
              >
                {link.label}
              </Button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

export function JourneySection() {
  return (
    <section className="home-journey" data-testid="home-journey">
      <SectionHeader eyebrow="— HIGH SCORE —" title="開發歷程" />
      <div className="relative">
        <div className="home-journey__line" aria-hidden="true" />
        {JOURNEY.map((item, i) => (
          <JourneyNode key={item.year} item={item} isLast={i === JOURNEY.length - 1} />
        ))}
      </div>
    </section>
  )
}

export default JourneySection
