import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { clsx } from 'clsx'

export interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** lucide-react 圖示（strokeWidth={2.5}） */
  icon: ReactNode
  /** 無障礙名稱 */
  label: string
}

export function IconButton({ icon, label, className, ...rest }: IconButtonProps) {
  return (
    <button type="button" aria-label={label} {...rest} className={clsx('tb-iconbtn', 'tb-lift-s', className)}>
      {icon}
    </button>
  )
}
