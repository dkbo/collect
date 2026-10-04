import { useEffect, useState } from 'react'
import { clsx } from 'clsx'

export interface HandheldProps {
  /** 單張螢幕截圖（WebP） */
  image?: string
  /** 多張截圖輪播；有它時忽略 image */
  images?: string[]
  imageAlt?: string
  /** 每張截圖各自的 alt，缺的退回 imageAlt */
  imageAlts?: string[]
  /** 螢幕字幕左側（只用英數），預設 NOW PLAYING */
  left?: string
  /** 螢幕字幕右側；多張時預設顯示 1/N */
  right?: string
  /** 機身型號字 */
  model?: string
  /** 受控的目前張數；不傳則元件自管 */
  index?: number
  onIndexChange?: (index: number) => void
  /** 自動換下一張的毫秒數；0 關閉。prefers-reduced-motion 時不自動換 */
  autoPlayMs?: number
  /** A 鍵：帶目前張數 */
  onA?: (index: number) => void
  /** B 鍵：有多張時先換下一張，再帶新的張數 */
  onB?: (index: number) => void
  aLabel?: string
  bLabel?: string
  className?: string
}

export function Handheld({
  image,
  images,
  imageAlt,
  imageAlts,
  left = 'NOW PLAYING',
  right,
  model = 'DKBO·BOY',
  index,
  onIndexChange,
  autoPlayMs = 4000,
  onA,
  onB,
  aLabel = 'A 鍵',
  bLabel = 'B 鍵',
  className,
}: HandheldProps) {
  const list = images ?? (image ? [image] : [])
  const count = list.length
  const [inner, setInner] = useState(0)
  const current = count ? (index ?? inner) % count : 0

  const step = (from: number) => {
    const next = count ? (from + 1) % count : 0
    if (index === undefined) setInner(next)
    onIndexChange?.(next)
    return next
  }

  useEffect(() => {
    if (!autoPlayMs || count < 2) return
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return
    const id = window.setTimeout(() => {
      const next = (current + 1) % count
      if (index === undefined) setInner(next)
      onIndexChange?.(next)
    }, autoPlayMs)
    return () => window.clearTimeout(id)
  }, [autoPlayMs, count, current, index, onIndexChange])

  // 先換張再呼叫：寫成 onB?.(step(…)) 時，沒傳 onB 會連引數都不求值、不換張
  const pressB = () => {
    const next = count > 1 ? step(current) : current
    onB?.(next)
  }

  const src = list[current]
  const caption = right ?? (count > 1 ? `${current + 1}/${count}` : undefined)

  return (
    <div className={clsx('tb-hand', className)}>
      <div className="tb-hand__screen">
        {src && <img className="tb-hand__img" src={src} alt={imageAlts?.[current] ?? imageAlt ?? ''} decoding="async" />}
        <div className="tb-hand__caption">
          <span>{left}</span>
          {caption && <span>{caption}</span>}
        </div>
      </div>
      <div className="tb-hand__pad">
        <div className="tb-hand__dpad" aria-hidden="true">
          <span className="tb-hand__dpad-v" />
          <span className="tb-hand__dpad-h" />
        </div>
        <div className="tb-hand__ab">
          <button type="button" className="tb-hand__key" aria-label={bLabel} onClick={pressB}>
            B
          </button>
          <button type="button" className="tb-hand__key" aria-label={aLabel} onClick={() => onA?.(current)}>
            A
          </button>
        </div>
      </div>
      <div className="tb-hand__pills" aria-hidden="true">
        <span className="tb-hand__pill" />
        <span className="tb-hand__pill" />
      </div>
      <div className="tb-hand__model">{model}</div>
    </div>
  )
}
