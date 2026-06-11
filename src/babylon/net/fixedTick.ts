/**
 * 固定步長模擬計時器（Phase A 工具層）。
 * 以 setInterval 驅動而非 render loop：分頁切背景時 rAF 會被節流，
 * 但模擬（尤其 host authority）必須持續推進。渲染端只讀模擬結果做插值。
 */

export interface FixedTicker {
  start(): void
  stop(): void
  /** 已執行的 tick 數（從 0 起算） */
  readonly tick: number
  readonly running: boolean
}

/** accumulator 上限：落後過多時丟棄（避免切回分頁瞬間補跑數百 tick） */
const MAX_ACCUM_MS = 250

/**
 * @param hz 模擬頻率（建議 30）
 * @param onTick 每 tick 回呼；stepMs 固定為 1000/hz
 */
export const createFixedTicker = (
  hz: number,
  onTick: (tick: number, stepMs: number) => void
): FixedTicker => {
  const stepMs = 1000 / hz
  let timer: ReturnType<typeof setInterval> | null = null
  let tick = 0
  let last = 0
  let accum = 0

  const pump = () => {
    const now = performance.now()
    accum = Math.min(accum + (now - last), MAX_ACCUM_MS)
    last = now
    while (accum >= stepMs) {
      accum -= stepMs
      onTick(tick++, stepMs)
    }
  }

  return {
    start() {
      if (timer) return
      last = performance.now()
      accum = 0
      // 以半步長輪詢，pump 內部用真實時間補齊，tick 間隔穩定
      timer = setInterval(pump, stepMs / 2)
    },
    stop() {
      if (timer) clearInterval(timer)
      timer = null
    },
    get tick() {
      return tick
    },
    get running() {
      return timer !== null
    },
  }
}
