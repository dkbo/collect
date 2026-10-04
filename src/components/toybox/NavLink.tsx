import type { ReactNode } from 'react'
import { clsx } from 'clsx'
import { ChevronDown } from 'lucide-react'
import { Link, NavLink as RouterNavLink, type LinkProps, type NavLinkProps as RouterNavLinkProps } from 'react-router-dom'

export interface NavLinkProps extends Omit<RouterNavLinkProps, 'className' | 'style' | 'children'> {
  /** 不傳時由路由決定；傳 true／false 則強制（例：下拉群組內有目前頁） */
  current?: boolean
  /** 後面加下拉箭頭 */
  menu?: boolean
  className?: string
  children?: ReactNode
}

export function NavLink({ current, menu, className, children, ...rest }: NavLinkProps) {
  const cls = clsx('tb-nav', className)
  const content = (
    <>
      {children}
      {menu && <ChevronDown strokeWidth={2.5} aria-hidden="true" />}
    </>
  )

  if (current !== undefined) {
    // end／caseSensitive 只有 RouterNavLink 認得
    const linkProps: Record<string, unknown> = { ...rest }
    delete linkProps.end
    delete linkProps.caseSensitive
    return (
      <Link {...(linkProps as unknown as LinkProps)} className={cls} aria-current={current ? 'page' : undefined}>
        {content}
      </Link>
    )
  }

  return (
    <RouterNavLink {...rest} className={cls}>
      {content}
    </RouterNavLink>
  )
}
