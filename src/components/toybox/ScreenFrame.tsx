import type { ReactNode } from 'react'
import { clsx } from 'clsx'

export interface ScreenFrameProps {
  /** 上方點陣標題列（只用英數大寫） */
  title: string
  /** 標題列右側資訊（只用英數大寫） */
  meta?: string
  className?: string
  /** 畫面區（tb-screen__view）的 class：高度由頁面決定，例 h-[75dvh] sm:h-[80dvh]、aspect-video */
  viewClassName?: string
  children?: ReactNode
}

/** 遊戲畫面外框（pages-spec §1）：inverse 底、border-l、radius-md，canvas／iframe 放在 children */
export function ScreenFrame({ title, meta, className, viewClassName, children }: ScreenFrameProps) {
  return (
    <div className={clsx('tb-screen', className)}>
      <div className="tb-screen__bar">
        <span className="tb-screen__title">{title}</span>
        {meta && <span className="tb-screen__meta">{meta}</span>}
      </div>
      <div className={clsx('tb-screen__view', viewClassName)}>{children}</div>
    </div>
  )
}
