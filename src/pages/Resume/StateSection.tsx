import { useEffect, useState } from 'react'
import { Tag } from '@/components/toybox'
import PanelHead from '@/pages/Resume/PanelHead'
import { CHART_TONE } from '@/pages/Resume/skills'

interface ChartProps {
  color: keyof typeof CHART_TONE
  percent: number
  text: string
}

function Chart({ color, percent, text }: ChartProps) {
  const [animatedPercent, setAnimatedPercent] = useState(0)

  useEffect(() => {
    const timer = setTimeout(() => {
      setAnimatedPercent(percent)
    }, 300)
    return () => clearTimeout(timer)
  }, [percent])

  const radius = 50
  const circumference = 2 * Math.PI * radius
  const strokeDashoffset = circumference - (animatedPercent / 100) * circumference

  return (
    <div className="flex flex-col items-center gap-2" role="img" aria-label={`${text} 熟練度 ${percent}%`}>
      <div className="resume-chart">
        <svg className="size-full -rotate-90" viewBox="0 0 120 120" aria-hidden="true">
          <circle cx="60" cy="60" r={radius} className="resume-ring__track" strokeWidth="10" />
          <circle
            cx="60"
            cy="60"
            r={radius}
            className="resume-ring__bar"
            strokeWidth="10"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="butt"
          />
        </svg>
        <div className="resume-chart__center">
          <span className="resume-chart__pct">{animatedPercent}%</span>
        </div>
      </div>
      <Tag tone={CHART_TONE[color]}>{text}</Tag>
    </div>
  )
}

export function StateSection() {
  return (
    <section className="resume-panel" data-testid="resume-state">
      <PanelHead title="狀態" code="STATS" />
      <div className="resume-panel__body">
        <div className="resume-charts">
          <Chart color="green" percent={92} text="Vue" />
          <Chart color="blue" percent={85} text="React" />
          <Chart color="red" percent={82} text="TypeScript" />
          <Chart color="red" percent={88} text="HTML / CSS" />
          <Chart color="green" percent={90} text="Javascript" />
          <Chart color="blue" percent={90} text="AI 協作" />
        </div>
      </div>
    </section>
  )
}

export default StateSection
