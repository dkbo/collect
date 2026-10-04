import type { ReactNode } from 'react'
import { clsx } from 'clsx'

export interface CtaPanelProps {
  /** 點陣眉標（只用英數），例：CONTINUE? */
  eyebrow?: string
  title: string
  body?: string
  /** 按鈕（用 pop／secondary，陰影自動改 on-inverse） */
  children?: ReactNode
  className?: string
}

export function CtaPanel({ eyebrow, title, body, children, className }: CtaPanelProps) {
  return (
    <div className={clsx('tb-cta', 'tb-on-inverse', className)}>
      <div className="tb-cta__text">
        {eyebrow && <span className="tb-cta__eyebrow">{eyebrow}</span>}
        <h2 className="tb-cta__title">{title}</h2>
        {body && <p className="tb-cta__body">{body}</p>}
      </div>
      {children && <div className="tb-cta__actions">{children}</div>}
    </div>
  )
}
