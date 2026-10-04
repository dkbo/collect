import { clsx } from 'clsx'

export interface MarqueeProps {
  items: string[]
  className?: string
}

/** 全寬跑馬燈：放在 tb-container 外；prefers-reduced-motion 時停住 */
export function Marquee({ items, className }: MarqueeProps) {
  const line = `★ ${items.join(' ★ ')} ★`
  return (
    <div className={clsx('tb-marquee', className)} role="note" aria-label={items.join('、')}>
      <div className="tb-marquee__band">
        <div className="tb-marquee__track" aria-hidden="true">
          <span className="tb-marquee__seg">{line}</span>
          <span className="tb-marquee__seg">{line}</span>
        </div>
      </div>
    </div>
  )
}
