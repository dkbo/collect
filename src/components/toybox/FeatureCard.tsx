import type { MouseEventHandler } from 'react'
import { clsx } from 'clsx'
import { Play } from 'lucide-react'
import { ToyLink } from '@/components/toybox/link'
import { TagList } from '@/components/toybox/Tag'
import { pickDataAttributes, type DataAttributes, type TagInput } from '@/components/toybox/utils'

export interface FeatureCardProps extends DataAttributes {
  title: string
  desc?: string
  /** 面板上方點陣字 Meta（只用英數） */
  meta?: string
  /** 截圖左上角徽章（只用英數） */
  badge?: string
  /** 面板底部的假按鈕文字 */
  cta?: string
  image?: string
  imageAlt?: string
  tags?: TagInput[]
  href?: string
  onClick?: MouseEventHandler<HTMLAnchorElement>
  className?: string
}

export function FeatureCard(props: FeatureCardProps) {
  const { title, desc, meta, badge, cta, image, imageAlt, tags, href, onClick, className } = props
  const body = (
    <>
      <div className="tb-feature__media">
        {image && <img className="tb-feature__img" src={image} alt={imageAlt ?? ''} loading="lazy" decoding="async" />}
        {badge && <span className="tb-feature__badge">{badge}</span>}
      </div>
      <div className="tb-feature__panel">
        {meta && <span className="tb-feature__meta">{meta}</span>}
        <h3 className="tb-feature__title">{title}</h3>
        {desc && <p className="tb-feature__desc">{desc}</p>}
        <TagList tags={tags} />
        {cta && (
          <span className="tb-feature__cta">
            <Play strokeWidth={2.5} aria-hidden="true" />
            {cta}
          </span>
        )}
      </div>
    </>
  )
  const data = pickDataAttributes(props)

  if (!href) {
    return (
      <article {...data} className={clsx('tb-feature', className)}>
        {body}
      </article>
    )
  }
  return (
    <ToyLink {...data} href={href} onClick={onClick} className={clsx('tb-feature', 'tb-lift', className)}>
      {body}
    </ToyLink>
  )
}
