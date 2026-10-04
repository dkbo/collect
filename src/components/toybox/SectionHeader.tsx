import type { ReactNode } from 'react'
import { clsx } from 'clsx'

export interface SectionHeaderProps {
  /** 點陣眉標（只用英數），例：— SELECT GAME — */
  eyebrow?: string
  title: string
  /** 給標題的 id（aria-labelledby 用） */
  id?: string
  /** 標題標籤；頁首當頁面標題時用 h1，預設 h2 */
  as?: 'h1' | 'h2'
  /** 右側控制項（例：SegmentedControl） */
  children?: ReactNode
  className?: string
}

export function SectionHeader({ eyebrow, title, id, as: Title = 'h2', children, className }: SectionHeaderProps) {
  return (
    <div className={clsx('tb-sechead', className)}>
      <div className="tb-sechead__text">
        {eyebrow && <span className="tb-sechead__eyebrow">{eyebrow}</span>}
        <Title className="tb-sechead__title" id={id}>
          {title}
        </Title>
      </div>
      {children}
    </div>
  )
}
