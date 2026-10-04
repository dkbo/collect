import type { AnchorHTMLAttributes, ButtonHTMLAttributes, MouseEvent, ReactNode } from 'react'
import { clsx } from 'clsx'
import { ToyLink } from '@/components/toybox/link'

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** primary = action 橘紅（每畫面最多一顆）；secondary = 白底；pop = 品牌黃；ink = 反白 */
  variant?: 'primary' | 'secondary' | 'pop' | 'ink'
  /** l = 52px 高（預設）；s = 44px 高 */
  size?: 'l' | 's'
  icon?: ReactNode
  iconEnd?: ReactNode
  /** 有 href 時渲染成 react-router Link（站外為 <a>） */
  href?: string
}

/** <a> 不認得的 button 專屬屬性 */
const BUTTON_ONLY = ['form', 'formAction', 'formEncType', 'formMethod', 'formNoValidate', 'formTarget', 'name', 'value', 'type'] as const

export function Button({ variant = 'secondary', size = 'l', icon, iconEnd, href, className, children, ...rest }: ButtonProps) {
  const cls = clsx('tb-btn', size === 's' ? 'tb-lift-s' : 'tb-lift', `tb-btn--${variant}`, `tb-btn--${size}`, className)

  if (href) {
    const { disabled, ...props } = rest
    const anchorProps: Record<string, unknown> = { ...props }
    for (const key of BUTTON_ONLY) delete anchorProps[key]
    const { onClick, tabIndex } = anchorProps as AnchorHTMLAttributes<HTMLAnchorElement>
    return (
      <ToyLink
        {...(anchorProps as AnchorHTMLAttributes<HTMLAnchorElement>)}
        href={href}
        className={cls}
        onClick={disabled ? (e: MouseEvent<HTMLAnchorElement>) => e.preventDefault() : onClick}
        aria-disabled={disabled || undefined}
        tabIndex={disabled ? -1 : tabIndex}
      >
        {icon}
        {children}
        {iconEnd}
      </ToyLink>
    )
  }

  return (
    <button type="button" {...rest} className={cls}>
      {icon}
      {children}
      {iconEnd}
    </button>
  )
}
