import type { ReactNode } from 'react'
import { clsx } from 'clsx'

export interface SectionHeaderProps {
  /** 點陣眉標（只用英數），例：— SELECT GAME — */
  eyebrow?: string
  title: string
  /** 給 h2 的 id（aria-labelledby 用） */
  id?: string
  /** 右側控制項（例：SegmentedControl） */
  children?: ReactNode
  className?: string
}

export function SectionHeader({ eyebrow, title, id, children, className }: SectionHeaderProps) {
  return (
    <div className={clsx('tb-sechead', className)}>
      <div className="tb-sechead__text">
        {eyebrow && <span className="tb-sechead__eyebrow">{eyebrow}</span>}
        <h2 className="tb-sechead__title" id={id}>
          {title}
        </h2>
      </div>
      {children}
    </div>
  )
}
