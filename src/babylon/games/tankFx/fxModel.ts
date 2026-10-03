/**
 * 坦克特效的時間曲線與小規則（spec §6／§8，純函式）：只算「現在該長什麼樣」，畫在 effects.ts／tank.ts。
 * 時間一律傳毫秒（經過時間或到期時刻），超出範圍回「沒在播」。
 */
import { clamp01, easeOut } from '@/babylon/fx/curves'
import { hexToRgb } from '@/babylon/fx/palette'

// ---- 無敵閃爍（spec §6：visibility 1↔0.35，10Hz） ----

export const INVULN_BLINK_HZ = 10
export const INVULN_DIM = 0.35

/** 以剩餘時間算相位（各端一致）；開頭先亮半個週期，到期後恆為 1 */
export function invulnVisibility(now: number, until: number): number {
  const left = until - now
  if (left <= 0) return 1
  return Math.ceil((left / 1000) * INVULN_BLINK_HZ * 2) % 2 === 0 ? 1 : INVULN_DIM
}

// ---- 受擊閃白（spec §6：80ms 全白、120ms 淡出） ----

export const FLASH_ALPHA = 0.75
const FLASH_HOLD_MS = 80
const FLASH_FADE_MS = 120

export function hitFlashAlpha(ms: number): number {
  if (!(ms >= 0)) return 0
  if (ms < FLASH_HOLD_MS) return FLASH_ALPHA
  const u = (ms - FLASH_HOLD_MS) / FLASH_FADE_MS
  return u < 1 ? FLASH_ALPHA * (1 - u) : 0
}

// ---- 鏡頭微震（spec §8 #17） ----

export const SHAKE_MS = 180
export const SHAKE_AMP = 0.25

/** 線性衰減的振幅；不在 0..SHAKE_MS 內為 0 */
export function shakeAmp(ms: number): number {
  return ms >= 0 && ms < SHAKE_MS ? SHAKE_AMP * (1 - ms / SHAKE_MS) : 0
}

/** prefers-reduced-motion 或手機檔不震 */
export const shakeAllowed = (o: { reducedMotion: boolean; tier: 'desktop' | 'mobile' }): boolean =>
  !o.reducedMotion && o.tier === 'desktop'

// ---- 砲口焰／拾取光柱／爆炸火球 ----

export const MUZZLE_MS = 90

/** 砲口焰：前半 scale 0.5→1.0，後 40% 淡出 */
export function muzzlePose(ms: number): { scale: number; alpha: number } | null {
  const t = ms / MUZZLE_MS
  if (!(t >= 0 && t < 1)) return null
  return { scale: 0.5 + 0.5 * clamp01(t / 0.5), alpha: t < 0.6 ? 1 : 1 - (t - 0.6) / 0.4 }
}

const BEAM_RISE_MS = 120
const BEAM_FADE_MS = 280
export const BEAM_MS = BEAM_RISE_MS + BEAM_FADE_MS

/** 拾取光柱：120ms 內長到全高，再 280ms 淡出 */
export function beamPose(ms: number): { sy: number; alpha: number } | null {
  if (!(ms >= 0 && ms < BEAM_MS)) return null
  if (ms < BEAM_RISE_MS) return { sy: easeOut(ms / BEAM_RISE_MS), alpha: 1 }
  return { sy: 1, alpha: 1 - (ms - BEAM_RISE_MS) / BEAM_FADE_MS }
}

export const FIREBALL_MS = 300

/** 爆炸火球：scale 0.4→1.2、後 60% 淡出；stage 0/1/2 依序對到 flash 三層色 */
export function fireballPose(ms: number): { scale: number; alpha: number; stage: 0 | 1 | 2 } | null {
  const t = ms / FIREBALL_MS
  if (!(t >= 0 && t < 1)) return null
  const stage = t < 1 / 3 ? 0 : t < 2 / 3 ? 1 : 2
  return { scale: 0.4 + 0.8 * easeOut(t), alpha: t < 0.4 ? 1 : 1 - (t - 0.4) / 0.6, stage }
}

// ---- 護盾泡泡、三連發光環（spec §6、§8 #8／#9） ----

export const EXPIRY_WARN_MS = 2000
const EXPIRY_BLINK_HZ = 6
export const SHIELD_BREAK_MS = 220
export const SHIELD_FADE_MS = 300
const EXPIRY_DIM = 0.35

/** buff 到期前 2 秒以 6Hz 閃（相位以剩餘時間算） */
export function expiryBlinkOn(now: number, until: number): boolean {
  const left = until - now
  if (left <= 0) return false
  if (left > EXPIRY_WARN_MS) return true
  return Math.ceil((left / 1000) * EXPIRY_BLINK_HZ * 2) % 2 === 0
}

/** 護盾泡泡：被打破（220ms 放大淡出）＞有效（最後 2 秒閃）＞自然到期（300ms 淡出）；null＝收起 */
export function shieldPose(now: number, until: number, brokeAt: number): { scale: number; alpha: number } | null {
  const b = (now - brokeAt) / SHIELD_BREAK_MS
  if (b >= 0 && b < 1) return { scale: 1 + 0.25 * easeOut(b), alpha: 1 - b }
  if (until > now) return { scale: 1, alpha: expiryBlinkOn(now, until) ? 1 : EXPIRY_DIM }
  const f = (now - until) / SHIELD_FADE_MS
  if (until > 0 && f >= 0 && f < 1) return { scale: 1, alpha: 1 - f }
  return null
}

// ---- 連殺字卡（spec §8 #16） ----

export const STREAK_WINDOW_MS = 4000

export interface Streak {
  count: number
  lastAt: number
}

/** 同一條命內、距上一殺 ≤ 4 秒就累加，否則從 1 算起（陣亡時由呼叫端清掉） */
export function streakAfterKill(prev: Streak | undefined, now: number): Streak {
  if (prev && now - prev.lastAt <= STREAK_WINDOW_MS) return { count: prev.count + 1, lastAt: now }
  return { count: 1, lastAt: now }
}

export const streakLabel = (count: number): '雙殺' | '三殺' | null => (count >= 3 ? '三殺' : count === 2 ? '雙殺' : null)

export const CARD_POP_MS = 260
export const CARD_HOLD_MS = 900
export const CARD_LEAVE_MS = 300
const CARD_PEAK = 1.25
const CARD_RISE = 0.6

/** 字卡：0→1.25→1 彈出、停留、上飄淡出；null＝播完 */
export function cardPose(ms: number): { scale: number; rise: number; alpha: number } | null {
  if (!(ms >= 0)) return null
  if (ms < CARD_POP_MS) {
    const t = ms / CARD_POP_MS
    const scale = t < 0.6 ? CARD_PEAK * easeOut(t / 0.6) : CARD_PEAK - (CARD_PEAK - 1) * easeOut((t - 0.6) / 0.4)
    return { scale, rise: 0, alpha: 1 }
  }
  if (ms < CARD_POP_MS + CARD_HOLD_MS) return { scale: 1, rise: 0, alpha: 1 }
  const u = (ms - CARD_POP_MS - CARD_HOLD_MS) / CARD_LEAVE_MS
  if (u >= 1) return null
  return { scale: 1, rise: CARD_RISE * easeOut(u), alpha: 1 - u }
}

// ---- 浮字圖集（spec §8.1：512×256，4 欄 × 4 列，每格 128×64） ----

/** 圖集格序：拾取浮字 5 格（依道具）＋連殺字卡 2 格 */
const FLOAT_KEYS = ['hp', 'speed', 'rapid', 'shield', 'triple', '雙殺', '三殺'] as const
/** 各格要畫的字 */
export const FLOAT_TEXTS = ['+1', '加速', '連射', '護盾', '×3', '雙殺', '三殺'] as const
/** 字卡格（奶油底＋深紫邊）從這格起 */
export const CARD_CELL_FROM = 5
export const FLOAT_COLS = 4
export const FLOAT_ROWS = 4

export const floatLabelIndex = (key: string): number => FLOAT_KEYS.indexOf(key as (typeof FLOAT_KEYS)[number])

/** 第 i 格的 [u0, v0, u1, v1]（canvas 上方是 v 大的一側） */
export function floatCellUV(i: number): [number, number, number, number] {
  const col = i % FLOAT_COLS
  const row = Math.floor(i / FLOAT_COLS)
  return [col / FLOAT_COLS, 1 - (row + 1) / FLOAT_ROWS, (col + 1) / FLOAT_COLS, 1 - row / FLOAT_ROWS]
}

// ---- 依移動距離出痕（履帶痕、揚塵） ----

/** 每累積 spacing 出一筆，餘數留到下次；單次位移 ≥ maxStep 視為瞬移不出 */
export function distanceSteps(acc: number, dist: number, spacing: number, maxStep = 1.5): { count: number; acc: number } {
  if (!(dist > 0) || dist >= maxStep) return { count: 0, acc }
  const total = acc + dist
  const count = Math.floor(total / spacing + 1e-9)
  return { count, acc: total - count * spacing }
}

// ---- 殘骸配色（spec §3：wreck light／base／dark 取代玩家色） ----

const WRECK = ['#2B2440', '#4A4566', '#6E6890'].map(hexToRgb)

/** 頂點色依亮度對到 wreck 三色（0→dark、0.5→base、1→light），alpha 不變 */
export function wreckColors(colors: ArrayLike<number>): Float32Array {
  const out = new Float32Array(colors.length)
  for (let o = 0; o + 3 < colors.length; o += 4) {
    const l = clamp01(0.299 * colors[o] + 0.587 * colors[o + 1] + 0.114 * colors[o + 2])
    const [a, b, k] = l < 0.5 ? [WRECK[0], WRECK[1], l / 0.5] : [WRECK[1], WRECK[2], (l - 0.5) / 0.5]
    for (let c = 0; c < 3; c++) out[o + c] = a[c] + (b[c] - a[c]) * k
    out[o + 3] = colors[o + 3]
  }
  return out
}
