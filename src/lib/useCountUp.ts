import { useEffect, useRef, useState, type RefObject } from 'react'

const clamp01 = (t: number) => Math.min(1, Math.max(0, t))

/** 三次方 ease-out，輸入自動 clamp 到 [0, 1] */
export function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - clamp01(t), 3)
}

/** 經過 elapsedMs 後應顯示的整數值 */
export function valueAt(target: number, elapsedMs: number, durationMs: number): number {
  if (durationMs <= 0) return target
  return Math.round(target * easeOutCubic(elapsedMs / durationMs))
}

export function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

/**
 * 元素進入視口後由 0 滾到 target（一次）。
 * reduced-motion 時直接顯示 target。把 ref 綁在顯示數字的元素上。
 */
export function useCountUp(target: number, durationMs = 1200): {
  value: number
  ref: RefObject<HTMLElement | null>
} {
  const ref = useRef<HTMLElement | null>(null)
  const reduced = prefersReducedMotion()
  const [value, setValue] = useState(reduced ? target : 0)

  useEffect(() => {
    if (reduced) return
    const el = ref.current
    if (!el) return

    let frame = 0
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry?.isIntersecting) return
        observer.disconnect()
        const start = performance.now()
        const tick = (now: number) => {
          const elapsed = now - start
          setValue(valueAt(target, elapsed, durationMs))
          if (elapsed < durationMs) frame = requestAnimationFrame(tick)
        }
        frame = requestAnimationFrame(tick)
      },
      { threshold: 0.3 },
    )
    observer.observe(el)
    return () => {
      observer.disconnect()
      cancelAnimationFrame(frame)
    }
  }, [target, durationMs, reduced])

  return { value, ref }
}
