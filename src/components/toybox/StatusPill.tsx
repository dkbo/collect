import type { ReactNode } from 'react'
import { clsx } from 'clsx'

export interface StatusPillProps {
  /** 狀態點顏色：success（預設）／pop／action */
  tone?: 'success' | 'pop' | 'action'
  children?: ReactNode
  className?: string
}

export function StatusPill({ tone, children, className }: StatusPillProps) {
  return (
    <span className={clsx('tb-status', tone && tone !== 'success' && `tb-status--${tone}`, className)}>
      <span className="tb-status__dot" aria-hidden="true" />
      {children}
    </span>
  )
}
