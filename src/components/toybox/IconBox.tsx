import type { ReactNode } from 'react'
import { clsx } from 'clsx'

export interface IconBoxProps {
  /** lucide-react 圖示（strokeWidth={2.5}） */
  icon: ReactNode
  tone?: 'sky' | 'pop' | 'mint' | 'pink'
  className?: string
}

export function IconBox({ icon, tone = 'sky', className }: IconBoxProps) {
  return (
    <span className={clsx('tb-iconbox', `tb-iconbox--${tone}`, className)} aria-hidden="true">
      {icon}
    </span>
  )
}
