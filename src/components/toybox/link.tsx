import type { AnchorHTMLAttributes } from 'react'
import { Link } from 'react-router-dom'
import { isExternalHref } from '@/components/toybox/utils'

export interface ToyLinkProps extends AnchorHTMLAttributes<HTMLAnchorElement> {
  href: string
}

/** 站內路由用 react-router Link，站外開新分頁 */
export function ToyLink({ href, children, ...rest }: ToyLinkProps) {
  if (isExternalHref(href)) {
    const external = /^https?:|^\/\//i.test(href)
    return (
      <a href={href} {...(external ? { target: '_blank', rel: 'noopener noreferrer' } : {})} {...rest}>
        {children}
      </a>
    )
  }
  return (
    <Link to={href} {...rest}>
      {children}
    </Link>
  )
}
