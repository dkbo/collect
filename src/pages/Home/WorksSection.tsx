import { useState } from 'react'
import { CartridgeCard, FeatureCard, SectionHeader } from '@/components/toybox'
import { selectWorks, type WorksFilter } from '@/pages/Home/worksView'

const FILTERS: readonly { id: WorksFilter; label: string }[] = [
  { id: 'all', label: '全部' },
  { id: 'game', label: '遊戲' },
  { id: 'tool', label: '工具' },
]

/** SegmentedControl 的同一組 tb-seg 外觀；自組是為了保留每個選項的 data-testid */
function WorksFilterControl({ value, onChange }: { value: WorksFilter; onChange: (v: WorksFilter) => void }) {
  return (
    <div className="tb-seg" role="group" aria-label="篩選作品">
      {FILTERS.map((f) => (
        <button
          key={f.id}
          type="button"
          className="tb-seg__opt"
          aria-pressed={value === f.id}
          onClick={() => onChange(f.id)}
          data-testid={`works-filter-${f.id}`}
        >
          {f.label}
        </button>
      ))}
    </div>
  )
}

export function WorksSection() {
  const [filter, setFilter] = useState<WorksFilter>('all')
  const { featured, cartridges } = selectWorks(filter)

  return (
    <section id="works" className="home-works" data-testid="home-works">
      <SectionHeader eyebrow="— SELECT GAME —" title="作品卡帶">
        <WorksFilterControl value={filter} onChange={setFilter} />
      </SectionHeader>

      {featured && (
        <FeatureCard
          href={featured.work.to}
          title={featured.work.title}
          desc={featured.work.desc}
          meta={`No.${featured.no} · 1-4P · ONLINE`}
          badge="★ FEATURED"
          cta="開房間"
          image={featured.work.shot}
          imageAlt={`${featured.work.title} 畫面截圖`}
          tags={[...featured.work.tags]}
          data-testid={`work-card-${featured.work.id}`}
        />
      )}

      <div className="home-works__grid">
        {cartridges.map(({ work, no }) => {
          const Icon = work.icon
          return (
            <CartridgeCard
              key={work.id}
              href={work.to}
              no={no}
              kind={work.kind}
              title={work.title}
              desc={work.desc}
              image={work.shot}
              imageAlt={`${work.title} 畫面截圖`}
              icon={Icon ? <Icon strokeWidth={2.5} /> : undefined}
              tags={[...work.tags]}
              data-testid={`work-card-${work.id}`}
            />
          )
        })}
      </div>
    </section>
  )
}

export default WorksSection
