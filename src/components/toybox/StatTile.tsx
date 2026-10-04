import type { ReactNode } from 'react'
import { clsx } from 'clsx'

export interface StatTileProps {
  value: ReactNode
  suffix?: string
  label: string
  className?: string
}

export function StatTile({ value, suffix, label, className }: StatTileProps) {
  return (
    <div className={clsx('tb-stat', className)}>
      <div className="tb-stat__num">
        {value}
        {suffix && <span>{suffix}</span>}
      </div>
      <div className="tb-stat__label">{label}</div>
    </div>
  )
}
