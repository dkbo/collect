import type { MouseEventHandler, ReactNode } from 'react'
import { clsx } from 'clsx'
import { IconBox, type IconBoxProps } from '@/components/toybox/IconBox'
import { ToyLink } from '@/components/toybox/link'
import { TagList } from '@/components/toybox/Tag'
import { pickDataAttributes, type DataAttributes, type TagInput } from '@/components/toybox/utils'

export interface CartridgeCardProps extends DataAttributes {
  /** 卡帶編號（標籤條顯示 No.xx） */
  no: string
  title: string
  desc?: string
  /** game = 黃標籤條＋截圖；tool = 灰標籤條＋IconBox */
  kind?: 'game' | 'tool'
  /** 16:9 WebP 截圖 */
  image?: string
  imageAlt?: string
  /** tool 用：標題左側 IconBox 的 lucide-react 圖示 */
  icon?: ReactNode
  iconTone?: IconBoxProps['tone']
  tags?: TagInput[]
  /** 整張卡是一個連結；不傳則為不可點的 article */
  href?: string
  onClick?: MouseEventHandler<HTMLAnchorElement>
  className?: string
}

export function CartridgeCard(props: CartridgeCardProps) {
  const { no, title, desc, kind = 'game', image, imageAlt, icon, iconTone, tags, href, onClick, className } = props
  const tool = kind === 'tool'
  const body = (
    <>
      <div className="tb-card__strip">
        <span>No.{no}</span>
        <span>{tool ? 'TOOL ▸' : 'GAME ▸'}</span>
      </div>
      {image && <img className="tb-card__media" src={image} alt={imageAlt ?? ''} loading="lazy" decoding="async" />}
      <div className="tb-card__body">
        <div className="tb-card__head">
          {icon && <IconBox icon={icon} tone={iconTone} />}
          <h3 className="tb-card__title">{title}</h3>
        </div>
        {desc && <p className="tb-card__desc">{desc}</p>}
        <TagList tags={tags} />
      </div>
    </>
  )
  const data = pickDataAttributes(props)

  if (!href) {
    return (
      <article {...data} className={clsx('tb-card', tool && 'tb-card--tool', className)}>
        {body}
      </article>
    )
  }
  return (
    <ToyLink {...data} href={href} onClick={onClick} className={clsx('tb-card', 'tb-lift', tool && 'tb-card--tool', className)}>
      {body}
    </ToyLink>
  )
}
