import { useEffect, useRef } from 'react'

/** 動作鈕：點按時對 window 派發對應按鍵事件 */
export interface TouchAction {
  label: string
  /** KeyboardEvent.key（小寫即遊戲端 e.key.toLowerCase() 後比對值），如 ' '、'e' */
  key: string
}

/**
 * 行動裝置觸控操作層：左側虛擬搖桿 → 方向鍵、右側動作鈕。
 *
 * 透過對 window 派發合成 KeyboardEvent（keydown/keyup）驅動，
 * 所有遊戲既有的鍵盤監聽（window + e.key.toLowerCase()）即可直接吃到，
 * 因此新增遊戲無須改動輸入邏輯，只要在 BabylonCanvas 登記動作鈕。
 */
export function TouchControls({ actions }: { actions: TouchAction[] }) {
  const baseRef = useRef<HTMLDivElement>(null)
  const thumbRef = useRef<HTMLDivElement>(null)
  const activeDirs = useRef<Set<string>>(new Set())
  const joyPointer = useRef<number | null>(null)

  const dispatchKey = (type: 'keydown' | 'keyup', key: string) =>
    window.dispatchEvent(new KeyboardEvent(type, { key, bubbles: true }))

  // 比對前後方向集合，差異處才派發按鍵（避免重複 keydown）
  const setDirs = (next: Set<string>) => {
    const cur = activeDirs.current
    for (const k of cur) if (!next.has(k)) dispatchKey('keyup', k)
    for (const k of next) if (!cur.has(k)) dispatchKey('keydown', k)
    activeDirs.current = next
  }

  const updateFromPoint = (clientX: number, clientY: number) => {
    const base = baseRef.current
    if (!base) return
    const r = base.getBoundingClientRect()
    const cx = r.left + r.width / 2
    const cy = r.top + r.height / 2
    const dx = clientX - cx
    const dy = clientY - cy
    const radius = r.width / 2
    const mag = Math.hypot(dx, dy)
    const clamped = Math.min(mag, radius)
    const ang = Math.atan2(dy, dx)
    const tx = Math.cos(ang) * clamped
    const ty = Math.sin(ang) * clamped
    if (thumbRef.current) thumbRef.current.style.transform = `translate(calc(-50% + ${tx}px), calc(-50% + ${ty}px))`

    const nx = dx / radius
    const ny = dy / radius
    const dz = 0.35 // 死區，避免輕觸誤判
    const next = new Set<string>()
    if (ny < -dz) next.add('arrowup')
    else if (ny > dz) next.add('arrowdown')
    if (nx < -dz) next.add('arrowleft')
    else if (nx > dz) next.add('arrowright')
    setDirs(next)
  }

  const onJoyDown = (e: React.PointerEvent) => {
    e.preventDefault()
    joyPointer.current = e.pointerId
    baseRef.current?.setPointerCapture(e.pointerId)
    updateFromPoint(e.clientX, e.clientY)
  }
  const onJoyMove = (e: React.PointerEvent) => {
    if (joyPointer.current !== e.pointerId) return
    e.preventDefault()
    updateFromPoint(e.clientX, e.clientY)
  }
  const onJoyUp = (e: React.PointerEvent) => {
    if (joyPointer.current !== e.pointerId) return
    joyPointer.current = null
    if (thumbRef.current) thumbRef.current.style.transform = 'translate(-50%, -50%)'
    setDirs(new Set())
  }

  // 卸載時釋放尚未抬起的按鍵，避免殘留按住狀態
  useEffect(() => {
    const dirs = activeDirs
    return () => {
      for (const k of dirs.current) {
        window.dispatchEvent(new KeyboardEvent('keyup', { key: k, bubbles: true }))
      }
      dirs.current = new Set()
    }
  }, [])

  const onActDown = (key: string) => (e: React.PointerEvent) => {
    e.preventDefault()
    dispatchKey('keydown', key)
  }
  const onActUp = (key: string) => (e: React.PointerEvent) => {
    e.preventDefault()
    dispatchKey('keyup', key)
  }

  return (
    <div className="pointer-events-none absolute inset-0 z-10 select-none" data-testid="touch-controls">
      {/* 虛擬搖桿（左下） */}
      <div
        ref={baseRef}
        onPointerDown={onJoyDown}
        onPointerMove={onJoyMove}
        onPointerUp={onJoyUp}
        onPointerCancel={onJoyUp}
        className="pointer-events-auto absolute size-28 touch-none rounded-full border border-white/20 bg-white/10 backdrop-blur-sm bottom-[max(1rem,env(safe-area-inset-bottom))] left-[max(1rem,env(safe-area-inset-left))]"
        aria-label="移動搖桿"
        data-testid="touch-joystick"
      >
        <div
          ref={thumbRef}
          style={{ transform: 'translate(-50%, -50%)' }}
          className="absolute left-1/2 top-1/2 size-12 rounded-full bg-white/45 shadow-lg"
        />
      </div>

      {/* 動作鈕（右下） */}
      {actions.length > 0 && (
        <div className="pointer-events-auto absolute flex gap-3 bottom-[max(1rem,env(safe-area-inset-bottom))] right-[max(1rem,env(safe-area-inset-right))]">
          {actions.map((a) => (
            <button
              key={a.key}
              onPointerDown={onActDown(a.key)}
              onPointerUp={onActUp(a.key)}
              onPointerCancel={onActUp(a.key)}
              onPointerLeave={onActUp(a.key)}
              className="size-16 touch-none rounded-full border border-white/20 bg-indigo-500/40 text-3xl text-white backdrop-blur-sm shadow-lg active:bg-indigo-500/70"
              aria-label={`動作 ${a.label}`}
              data-testid="touch-action"
            >
              {a.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

export default TouchControls
