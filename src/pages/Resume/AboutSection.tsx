import type { ReactNode } from 'react'
import { Mail, MapPin, User, Calendar, Award, ArrowUpRight } from 'lucide-react'
import { IconBox, StatusPill } from '@/components/toybox'
import useScrollAnimation from '@/lib/useScrollAnimation'
import PanelHead from '@/pages/Resume/PanelHead'

interface SkillRingProps {
  percentage: number
  label: string
}

const RING_RADIUS = 28
const RING_STROKE = 5.5

function SkillRing({ percentage, label }: SkillRingProps) {
  const circumference = 2 * Math.PI * RING_RADIUS
  const strokeDashoffset = circumference - (percentage / 100) * circumference

  return (
    <div className="resume-ring">
      <div className="relative flex size-18 items-center justify-center">
        <svg className="size-full -rotate-90" viewBox="0 0 72 72" aria-hidden="true">
          <circle cx="36" cy="36" r={RING_RADIUS} className="resume-ring__track" strokeWidth={RING_STROKE} />
          <circle
            cx="36"
            cy="36"
            r={RING_RADIUS}
            className="resume-ring__bar"
            strokeWidth={RING_STROKE}
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="butt"
          />
        </svg>
        <span className="resume-ring__pct">{percentage}%</span>
      </div>
      <span className="resume-ring__label">{label}</span>
    </div>
  )
}

const COMPETENCIES = [
  { id: 'arch', percentage: 95, label: '前端架構' },
  { id: 'uiux', percentage: 90, label: '介面互動' },
  { id: 'perf', percentage: 88, label: '效能優化' },
  { id: 'ai', percentage: 92, label: 'AI 協作開發' },
]

const BIO_TEXT =
  '擁有超過 13 年資訊相關經驗，其中 10 年以上專注於前端開發與系統架構設計。熟悉 Vue、React、Nuxt、Next.js 等主流框架，參與過大型 B2B / B2C 平台、財務系統與遊戲平台開發，並擔任技術帶領角色，負責程式碼審查與新人培訓。近兩年深耕 AI 輔助開發流程（Claude Code、AI Agent Workflow、Vibe Coding），致力打造穩定、高效且具長期維護性的產品。'

function InfoBody({ label, value, end }: { label: string; value: string; end?: ReactNode }) {
  return (
    <>
      <span className="min-w-0 flex-1">
        <span className="resume-info__key">{label}</span>
        <span className="resume-info__val">{value}</span>
      </span>
      {end}
    </>
  )
}

export function AboutSection() {
  const containerRef = useScrollAnimation()

  return (
    <section ref={containerRef} className="@container resume-panel" data-testid="resume-about">
      <PanelHead title="關於我 (About Me)" code="P1" pop />

      <div className="resume-panel__body">
        <div className="resume-profile">
          <div className="resume-avatar animate-on-scroll animate-scale-in">
            <img
              src="https://avatars.githubusercontent.com/u/10608131?v=3"
              alt="盧宏寶 頭像"
              className="size-full object-cover"
              data-testid="resume-avatar-image"
              loading="lazy"
            />
          </div>

          <div className="flex w-full min-w-0 flex-1 flex-col gap-3 text-center @xl:text-left">
            <div className="flex flex-col gap-2">
              <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-2 @xl:justify-start">
                <h3 className="resume-name">
                  盧宏寶
                  <Award className="size-5 shrink-0" strokeWidth={2.5} aria-hidden="true" />
                </h3>
                <StatusPill tone="success">Open to Work / 歡迎聯繫</StatusPill>
              </div>
              <p className="resume-role">Senior Frontend Architect</p>
            </div>
            <p className="resume-bio">{BIO_TEXT}</p>
          </div>
        </div>

        {/* 能力環 */}
        <div className="resume-rings">
          {COMPETENCIES.map((comp) => (
            <SkillRing key={comp.id} percentage={comp.percentage} label={comp.label} />
          ))}
        </div>

        {/* 資訊四格 */}
        <div className="resume-info">
          <div className="resume-info__item">
            <IconBox icon={<User strokeWidth={2.5} />} tone="sky" />
            <InfoBody label="CLASS" value="資深前端工程師" />
          </div>
          <div className="resume-info__item">
            <IconBox icon={<Calendar strokeWidth={2.5} />} tone="mint" />
            <InfoBody label="LEVEL" value="13+ 年資歷" />
          </div>
          <a href="mailto:dk880842@gmail.com" className="resume-info__item resume-info__link tb-lift-s" aria-label="寄信給盧宏寶">
            <IconBox icon={<Mail strokeWidth={2.5} />} tone="pink" />
            <InfoBody
              label="EMAIL"
              value="dk880842@gmail.com"
              end={<ArrowUpRight className="size-4 shrink-0 text-ink" strokeWidth={2.5} aria-hidden="true" />}
            />
          </a>
          <div className="resume-info__item">
            <IconBox icon={<MapPin strokeWidth={2.5} />} tone="pop" />
            <InfoBody label="LOCATION" value="台灣高雄市" />
          </div>
        </div>
      </div>
    </section>
  )
}

export default AboutSection
