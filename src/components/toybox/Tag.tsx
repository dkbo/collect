import type { ReactNode } from 'react'
import { clsx } from 'clsx'
import { normTags, type StickerTone, type TagInput } from '@/components/toybox/utils'

export interface TagProps {
  tone?: StickerTone
  /** s = 卡片內小標籤；l = 大貼紙（有硬陰影） */
  size?: 's' | 'l'
  /** 傾斜：1 = -3deg、2 = 3deg、3 = -7deg */
  tilt?: 1 | 2 | 3
  children?: ReactNode
  className?: string
}

export function Tag({ tone = 'sky', size = 's', tilt, children, className }: TagProps) {
  return (
    <span className={clsx('tb-tag', `tb-tag--${tone}`, size === 'l' && 'tb-tag--l', tilt && `tb-tilt-${tilt}`, className)}>
      {children}
    </span>
  )
}

/** 卡片內的標籤列；字串依序輪替貼紙色 */
export function TagList({ tags, className }: { tags?: TagInput[]; className?: string }) {
  const list = normTags(tags)
  if (!list.length) return null
  return (
    <div className={clsx('tb-tags', className)}>
      {list.map((t, i) => (
        <Tag key={`${t.label}-${i}`} tone={t.tone}>
          {t.label}
        </Tag>
      ))}
    </div>
  )
}
