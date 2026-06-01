import { useEffect, useState } from 'react'

interface ChartProps {
  color: 'red' | 'blue' | 'green'
  percent: number
  text: string
}

function Chart({ color, percent, text }: ChartProps) {
  const [animatedPercent, setAnimatedPercent] = useState(0)

  useEffect(() => {
    // Stagger animation slightly for a natural progressive load feel
    const timer = setTimeout(() => {
      setAnimatedPercent(percent)
    }, 300)
    return () => clearTimeout(timer)
  }, [percent])

  const radius = 50
  const circumference = 2 * Math.PI * radius
  const strokeDashoffset = circumference - (animatedPercent / 100) * circumference

  // Dynamic stroke colors for the three progress categories
  const strokeColors = {
    red: 'stroke-rose-500 dark:stroke-rose-400',
    blue: 'stroke-sky-500 dark:stroke-sky-400',
    green: 'stroke-emerald-500 dark:stroke-emerald-400',
  }

  const baseColors = {
    red: 'bg-rose-500/10 text-rose-600 dark:text-rose-400',
    blue: 'bg-sky-500/10 text-sky-600 dark:text-sky-400',
    green: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
  }

  return (
    <div className="flex flex-col items-center p-2 group">
      <div className="relative size-24 sm:size-28 md:size-32 transition-transform duration-300 group-hover:scale-105">
        <svg className="size-full -rotate-90" viewBox="0 0 120 120">
          {/* Background circle */}
          <circle
            cx="60"
            cy="60"
            r={radius}
            className="stroke-slate-100 dark:stroke-slate-800/80 fill-none"
            strokeWidth="10"
          />
          {/* Progress circle with smooth transition */}
          <circle
            cx="60"
            cy="60"
            r={radius}
            className={`fill-none ${strokeColors[color]} transition-[stroke-dashoffset] duration-1000 ease-out`}
            strokeWidth="8"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
          />
        </svg>
        {/* Central progress label */}
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-base sm:text-lg md:text-xl font-extrabold text-slate-800 dark:text-slate-100">
            {animatedPercent}%
          </span>
          <span className={`text-[9px] md:text-[10px] font-bold px-1.5 py-0.5 rounded-full mt-1 border border-current/25 ${baseColors[color]}`}>
            {text}
          </span>
        </div>
      </div>
    </div>
  )
}

export function StateSection() {
  return (
    <section className="resume-card" data-testid="resume-state">
      <h2 className="resume-card-header">狀態</h2>
      <div className="p-6 md:p-8">
        <div className="grid grid-cols-3 gap-2 sm:gap-4 justify-items-center">
          <Chart color="red" percent={80} text="HTML" />
          <Chart color="blue" percent={60} text="CSS" />
          <Chart color="green" percent={90} text="Javascript" />
        </div>
      </div>
    </section>
  )
}

export default StateSection
