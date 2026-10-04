import { useEffect, useState } from 'react'
import { clsx } from 'clsx'
import { Tag } from '@/components/toybox'
import PanelHead from '@/pages/Resume/PanelHead'

interface LogProps {
  name: string
  classor: string
  time: string
  index: number
}

function Log({ name, classor, time, index }: LogProps) {
  const [animate, setAnimate] = useState(false)

  useEffect(() => {
    const timer = setTimeout(() => {
      setAnimate(true)
    }, 400 + index * 180)
    return () => clearTimeout(timer)
  }, [index])

  return (
    <div
      className={clsx('resume-timeline__item', !animate && 'resume-timeline__item--hidden')}
      data-testid={`history-log-${index}`}
    >
      <span className="resume-timeline__dot" aria-hidden="true" />
      <div className="resume-timeline__card">
        <h4 className="resume-timeline__company">{name}</h4>
        <p className="resume-timeline__title">{classor}</p>
        <Tag tone="plain" className="resume-timeline__year">
          {time}
        </Tag>
      </div>
    </div>
  )
}

const LOGS = [
  { name: '中華系統整合股份有限公司', classor: '資深前端工程師', time: '2022-2025' },
  { name: '光曳資訊有限公司', classor: '資深前端工程師', time: '2017-2022' },
  { name: '中冠資訊股份有限公司', classor: '前端工程師', time: '2016-2017' },
  { name: '台灣惠多笑有限公司', classor: '前端工程師', time: '2013-2016' },
  { name: '崴鴻數位有限公司', classor: '系統工程師', time: '2012-2012' },
  { name: '宗賢科技有限公司', classor: '系統工程師', time: '2011-2012' },
  { name: '正修科技大學', classor: '電機系 四技畢業', time: '2006-2010' },
]

export function HistorySection() {
  return (
    <section className="resume-panel" data-testid="resume-history">
      <PanelHead title="經歷" code="LOG" />
      <div className="resume-panel__body">
        <div className="resume-timeline">
          <span className="resume-timeline__line" aria-hidden="true" />
          {LOGS.map((log, i) => (
            <Log key={log.name} {...log} index={i} />
          ))}
        </div>
      </div>
    </section>
  )
}

export default HistorySection
