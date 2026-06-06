import { useCallback, useEffect, useRef, useState, type RefObject } from 'react'

/**
 * 全螢幕切換 Hook：支援原生 Fullscreen API 時走原生路徑；
 * 不支援時（iPhone Safari 僅允許 video 全螢幕）fallback 成 CSS 偽全螢幕——
 * 呼叫端依 isFullscreen 自行套用 `fixed inset-0 h-dvh` 等樣式。
 * 偽全螢幕期間鎖定 body 捲動；onChange 在狀態變化後呼叫（如把焦點還給遊戲）。
 */
export function useFullscreen(
  targetRef: RefObject<HTMLElement | null>,
  onChange?: () => void
) {
  const [isFullscreen, setIsFullscreen] = useState(false)
  const onChangeRef = useRef(onChange)
  useEffect(() => {
    onChangeRef.current = onChange
  }, [onChange])

  // 原生路徑：fullscreenchange 同步狀態（含使用者按 ESC / 手勢退出）
  useEffect(() => {
    const onFullscreenChange = () => {
      setIsFullscreen(document.fullscreenElement === targetRef.current)
      onChangeRef.current?.()
    }
    document.addEventListener('fullscreenchange', onFullscreenChange)
    return () => document.removeEventListener('fullscreenchange', onFullscreenChange)
  }, [targetRef])

  // 偽全螢幕（無原生 fullscreenElement）時鎖定背景頁面捲動
  useEffect(() => {
    if (!isFullscreen || document.fullscreenElement) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [isFullscreen])

  const toggleFullscreen = useCallback(() => {
    const el = targetRef.current
    if (!el) return
    if (typeof el.requestFullscreen === 'function') {
      if (!document.fullscreenElement) {
        el.requestFullscreen().catch((err) => {
          console.error('Error enabling fullscreen:', err)
        })
      } else {
        document.exitFullscreen()
      }
    } else {
      // iOS Safari：無 Element.requestFullscreen → 純 state 切換偽全螢幕
      setIsFullscreen((v) => !v)
      onChangeRef.current?.()
    }
  }, [targetRef])

  return { isFullscreen, toggleFullscreen }
}

export default useFullscreen
