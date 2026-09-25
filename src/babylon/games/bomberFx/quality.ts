/**
 * 畫質檔位與自動降級（AC7，純邏輯）：開局依裝置選 desktop／mobile，網址參數可強制；
 * 遊戲中連續 60 幀平均低於 45fps 就依序關掉 描邊 → Glow → 陰影。
 */

export type BomberTier = 'desktop' | 'mobile'
export type DegradeStep = 'outline' | 'glow' | 'shadow'

export const DEGRADE_ORDER: readonly DegradeStep[] = ['outline', 'glow', 'shadow']

export interface TierEnv {
  /** location.search */
  search: string
  /** 觸控裝置 */
  touch: boolean
  /** navigator.hardwareConcurrency（取不到為 undefined） */
  cores: number | undefined
}

export interface TierSettings {
  outline: boolean
  glow: boolean
  bloom: boolean
  /** 陰影貼圖邊長 */
  shadowSize: number
  /** 每組粒子上限 */
  particleCap: number
  /** engine.setHardwareScalingLevel 的值 */
  hardwareScaling: number
}

const param = (search: string, key: string): string | null => new URLSearchParams(search).get(key)

export function pickTier(env: TierEnv): BomberTier {
  const forced = param(env.search, 'bomberTier')
  if (forced === 'desktop' || forced === 'mobile') return forced
  if (env.touch) return 'mobile'
  if (env.cores !== undefined && env.cores <= 4) return 'mobile'
  return 'desktop'
}

/** 合併 location.search 與 hash 路由內的 query（`#/battle?bomberTier=mobile`）；同名參數以 search 為準 */
export function tierQuery(search: string, hash: string): string {
  const q = hash.indexOf('?')
  const merged = new URLSearchParams(q >= 0 ? hash.slice(q + 1) : '')
  for (const [k, v] of new URLSearchParams(search)) merged.set(k, v)
  const s = merged.toString()
  return s ? `?${s}` : ''
}

export function noDegradeFlag(search: string): boolean {
  return param(search, 'bomberNoDegrade') === '1'
}

export function tierSettings(tier: BomberTier, devicePixelRatio: number): TierSettings {
  if (tier === 'mobile') {
    return { outline: false, glow: false, bloom: false, shadowSize: 512, particleCap: 60, hardwareScaling: 1.5 }
  }
  return {
    outline: true,
    glow: true,
    bloom: true,
    shadowSize: 1024,
    particleCap: 150,
    hardwareScaling: 1 / Math.min(Math.max(devicePixelRatio, 1), 2),
  }
}

/** 下一個可降的項目（已關的跳過）；全關回 null */
export function nextDegrade(active: Record<DegradeStep, boolean>): DegradeStep | null {
  return DEGRADE_ORDER.find((s) => active[s]) ?? null
}

export interface FpsWatchOptions {
  /** 視窗幀數 */
  window?: number
  /** 平均低於此 fps 觸發 */
  minFps?: number
  /** 開頭略過的幀數（shader 編譯、貼圖上傳的卡頓） */
  warmup?: number
  /** 單幀超過此毫秒視為暫停（切分頁、GC），清空視窗重來 */
  maxGapMs?: number
}

/** 連續 N 幀的平均 fps 監看；每湊滿一個視窗判一次，觸發後重新累積 */
export class FpsWatch {
  private readonly size: number
  private readonly minFps: number
  private readonly maxGapMs: number
  private skip: number
  private frames = 0
  private sumMs = 0

  constructor(opts: FpsWatchOptions = {}) {
    this.size = opts.window ?? 60
    this.minFps = opts.minFps ?? 45
    this.skip = opts.warmup ?? 30
    this.maxGapMs = opts.maxGapMs ?? 500
  }

  /** 餵一幀的毫秒；回傳 true 代表這個視窗平均低於門檻 */
  push(deltaMs: number): boolean {
    if (this.skip > 0) {
      this.skip--
      return false
    }
    if (!(deltaMs > 0) || deltaMs > this.maxGapMs) {
      this.frames = 0
      this.sumMs = 0
      return false
    }
    this.frames++
    this.sumMs += deltaMs
    if (this.frames < this.size) return false
    const fps = (this.frames * 1000) / this.sumMs
    this.frames = 0
    this.sumMs = 0
    return fps < this.minFps
  }
}
