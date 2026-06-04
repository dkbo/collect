import { useEffect, useState } from 'react'

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
      className={`timeline-item ${animate ? 'timeline-item-animated' : 'opacity-0 translate-y-4'}`}
      data-testid={`history-log-${index}`}
    >
      {/* Node Dot on the timeline */}
      <div className="timeline-dot" />

      {/* Stem Line connecting dot to card */}
      <div className="timeline-stem" />

      {/* Card Content */}
      <div className="bg-slate-50/50 dark:bg-slate-800/20 hover:bg-slate-50 dark:hover:bg-slate-800/40 border border-slate-100 dark:border-slate-800/40 rounded-xl p-4 transition-all duration-300 shadow-sm hover:shadow">
        <h4 className="text-sm sm:text-base font-bold text-slate-800 dark:text-slate-100">
          {name}
        </h4>
        <p className="text-xs sm:text-sm text-purple-600 dark:text-purple-400 font-semibold mt-1">
          {classor}
        </p>
        <span className="inline-block text-[10px] bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 px-2 py-0.5 rounded-full mt-2 border border-slate-200/50 dark:border-slate-700/50">
          {time}
        </span>
      </div>
    </div>
  )
}

export function HistorySection() {
  const [animateLine, setAnimateLine] = useState(false)

  useEffect(() => {
    const timer = setTimeout(() => {
      setAnimateLine(true)
    }, 200)
    return () => clearTimeout(timer)
  }, [])

  return (
    <section className="resume-card" data-testid="resume-history">
      <h2 className="resume-card-header">經歷</h2>
      <div className="p-6 md:p-8">
        <div className="timeline-container">
          {/* Vertical Timeline Line */}
          <div 
            className="timeline-line" 
            style={{ 
              height: animateLine ? '100%' : '0%',
              minHeight: animateLine ? '280px' : '0px'
            }}
          />

          {/* Staggered Log items */}
          <div className="space-y-1 md:space-y-0 relative">
            <Log name="中華系統整合股份有限公司" classor="資深前端工程師" time="2022-2025" index={0} />
            <Log name="光曳資訊有限公司" classor="資深前端工程師" time="2017-2022" index={1} />
            <Log name="中冠資訊股份有限公司" classor="前端工程師" time="2016-2017" index={2} />
            <Log name="台灣惠多笑有限公司" classor="前端工程師" time="2013-2016" index={3} />
            <Log name="崴鴻數位有限公司" classor="系統工程師" time="2012-2012" index={4} />
            <Log name="宗賢科技有限公司" classor="系統工程師" time="2011-2012" index={5} />
            <Log name="正修科技大學" classor="電機系 四技畢業" time="2006-2010" index={6} />
          </div>
        </div>
      </div>
    </section>
  )
}

export default HistorySection
