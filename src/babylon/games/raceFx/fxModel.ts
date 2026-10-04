/**
 * 賽車特效的時間曲線與小規則（spec §6／§8，純函式）：只算「現在該長什麼樣」，畫在 effects.ts／world.ts／race.ts。
 * 時間一律傳毫秒（經過時間或剩餘時間），超出範圍回「沒在播」（null 或原狀）。
 */
import { backOut, clamp01, easeOut } from '@/babylon/fx/curves'
import { squashPose } from '@/babylon/games/tankFx/juice'
import type { DriftTier } from '@/babylon/games/raceFx/raceNet'
import { DRIFT_COLORS } from '@/babylon/games/raceFx/palette'

// ---- 重生（§6、§8 #13）：從 y 3 落下 280ms，visibility 1↔0.3 方波 10Hz ----

export const GHOST_BLINK_HZ = 10
export const GHOST_DIM = 0.3
export const DROP_H = 3
export const DROP_MS = 280

/** 以剩餘時間算相位（各端一致）；到期後恆為 1 */
export function ghostVisibility(now: number, until: number): number {
  const left = until - now
  if (left <= 0) return 1
  return Math.ceil((left / 1000) * GHOST_BLINK_HZ * 2) % 2 === 0 ? 1 : GHOST_DIM
}

/** 落下高度（easeIn）；範圍外 0 */
export function respawnDropY(ms: number): number {
  if (!(ms >= 0 && ms < DROP_MS)) return 0
  const u = ms / DROP_MS
  return DROP_H * (1 - u * u)
}

// ---- 甩尾火花（§6、§8 #1）與加速噴焰（§8 #2） ----

const SPARK_RATE = [20, 40, 55, 70] as const
const SPARK_TIER_SCALE = [1, 1, 1.15, 1.3] as const

export function driftSparkLook(tier: DriftTier): { color: string; rate: number; size: number } {
  return { color: DRIFT_COLORS[tier], rate: SPARK_RATE[tier], size: SPARK_TIER_SCALE[tier] }
}

/**
 * 火花基準尺寸：spec 寫 0.18，但 ADD 混色的小火花在深紫路面上幾乎加不出亮度（波 4 qa BUG）；fx_spark.webp 只有約 11% 面積不透明，放大到 0.5（可見芯約 0.17）。
 * 段位倍率（×1／×1.15／×1.3）照舊乘在上面。
 */
export const SPARK_SIZE = 0.5
const HOT_MIX = 0.55

/** 火花出生色：段位色往白拉 55%（亮芯），之後淡回段位色；色相（最大通道）不變 */
export function sparkHot(hex: string): string {
  const n = parseInt(hex.slice(1), 16)
  const ch = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((c) => Math.round(c + (255 - c) * HOT_MIX))
  return `#${ch.map((c) => c.toString(16).padStart(2, '0').toUpperCase()).join('')}`
}

/** flame 三層（加速帶、加速菇；spec §3.2） */
export const FLAME = ['#FFF6C8', '#FFC53A', '#FF7A1A'] as const

/** 加速剛開始時：前一刻有甩尾段位 → mini-turbo 段位色；否則 flame */
export function boostColor(prevTier: DriftTier): { kind: 'turbo' | 'flame'; color: string } {
  return prevTier > 0 ? { kind: 'turbo', color: DRIFT_COLORS[prevTier] } : { kind: 'flame', color: FLAME[1] }
}

/** 加速 mini-turbo 判定：放開甩尾到加速開始之間的容許時間 */
export const TURBO_WINDOW_MS = 250

/**
 * 加速剛開始時算前一刻的甩尾段位（給 boostColor）：mini-turbo 只在放開甩尾那一刻給，
 * 所以本幀仍在甩尾（段位 > 0）就是加速帶／菇 → 0；否則看放開是否在窗口內
 */
export function turboTier(o: { drift: DriftTier; lastTier: DriftTier; lastTierAt: number; now: number }): DriftTier {
  if (o.drift > 0) return 0
  return o.now - o.lastTierAt <= TURBO_WINDOW_MS ? o.lastTier : 0
}

// ---- 尾流風線（§8 #3）、速度線（§8 #4） ----

export function slipLook(charging: boolean, active: boolean): { count: number; alpha: number } {
  if (active) return { count: 6, alpha: 0.7 }
  if (charging) return { count: 2, alpha: 0.35 }
  return { count: 0, alpha: 0 }
}

/** speedRatio = |speed| / MAX_SPEED；cap 見 speedLineCap */
export function speedLineAlpha(speedRatio: number, boosting: boolean, cap: number): number {
  const a = boosting ? 0.6 : 0.6 * clamp01((speedRatio - 0.9) / 0.1)
  return Math.min(a, cap)
}

/** prefers-reduced-motion 0.25、手機 0.35（spec §10）、其餘不限 */
export const speedLineCap = (o: { reducedMotion: boolean; mobile: boolean }): number =>
  o.reducedMotion ? 0.25 : o.mobile ? 0.35 : 1

// ---- 揚塵（§8 #5）、胎痕（§8 #6） ----

export const DUST_SPACING = 0.4
export const SKID_SPACING = 0.35
export const SKID_MS = 2500
const SKID_SHRINK_MS = 600

/** 胎痕：最後 0.6s 縮小代替淡出（thin instance 沒有逐筆 alpha）；到期 null */
export function skidScale(ageMs: number): number | null {
  if (!(ageMs >= 0 && ageMs < SKID_MS)) return null
  const left = SKID_MS - ageMs
  return left >= SKID_SHRINK_MS ? 1 : left / SKID_SHRINK_MS
}

// ---- 碰撞火花（§8 #7） ----

export const CLASH_SPEED = 4
export const CLASH_COOLDOWN_MS = 300

/** 兩車速度向量差的大小（ry 為移動方向） */
export function relSpeed(a: { speed: number; ry: number }, b: { speed: number; ry: number }): number {
  const dx = a.speed * Math.sin(a.ry) - b.speed * Math.sin(b.ry)
  const dz = a.speed * Math.cos(a.ry) - b.speed * Math.cos(b.ry)
  return Math.hypot(dx, dz)
}

export const clashKey = (a: string, b: string): string => (a < b ? `${a}|${b}` : `${b}|${a}`)

/** 同一對 300ms 內不重播；可以播時記下這次時間 */
export function clashReady(last: Map<string, number>, key: string, now: number): boolean {
  const prev = last.get(key)
  if (prev !== undefined && now - prev < CLASH_COOLDOWN_MS) return false
  last.set(key, now)
  return true
}

// ---- 道具箱碎裂與重生（§8 #8） ----

export const BREAK_MS = 450
export const BOX_POP_MS = 300
const CHUNK_G = 14

/** 碎塊相對箱子中心的位移（初速 vx/vy/vz）與縮放；到期 null */
export function chunkPose(ms: number, vx: number, vy: number, vz: number): { x: number; y: number; z: number; scale: number } | null {
  if (!(ms >= 0 && ms < BREAK_MS)) return null
  const t = ms / 1000
  return { x: vx * t, y: t * (vy - 0.5 * CHUNK_G * t), z: vz * t, scale: 1 - ms / BREAK_MS }
}

/** 重生彈出 0 → 1.1 → 1（backOut）；之後 1 */
export function boxPopScale(ms: number): number {
  if (!(ms < BOX_POP_MS)) return 1
  return ms <= 0 ? 0 : backOut(ms / BOX_POP_MS)
}

// ---- 打滑（§6、§8 #9／#10） ----

const SPIN_TURNS = 2
const SHELL_LIFT = 0.8
const SHELL_LIFT_MS = 400

/** ms 內轉 2 圈（easeOut）；龜殼命中另加前 400ms 彈起 */
export function spinPose(ms: number, dur: number, shell: boolean): { yaw: number; lift: number } {
  if (!(ms >= 0 && ms < dur)) return { yaw: 0, lift: 0 }
  const yaw = Math.PI * 2 * SPIN_TURNS * easeOut(ms / dur)
  const lift = shell && ms < SHELL_LIFT_MS ? SHELL_LIFT * Math.sin((Math.PI * ms) / SHELL_LIFT_MS) : 0
  return { yaw, lift }
}

export const BANANA_DIE_MS = 300

/** 被踩到的香蕉：原地彈起 0.6、轉 2 圈後縮小消失 */
export function dyingBananaPose(ms: number): { lift: number; spin: number; scale: number } | null {
  if (!(ms >= 0 && ms < BANANA_DIE_MS)) return null
  const u = ms / BANANA_DIE_MS
  return { lift: 0.6 * Math.sin(Math.PI * u), spin: Math.PI * 4 * easeOut(u), scale: 1 - u }
}

// ---- 護盾（§6、§8 #11） ----

export const SHIELD_BREAK_MS = 220
export const SHIELD_FADE_MS = 300
const SHIELD_WARN_MS = 2000
const SHIELD_BLINK_HZ = 6

/**
 * on：開著（leftMs 已知時最後 2 秒 6Hz 閃）；off：offMs 為關掉後經過時間，broke＝被擋下（膨脹碎掉）否則到期淡出。
 * 回傳 null 表示不畫。
 */
export function shieldPose(o: { on: boolean; leftMs: number | null; offMs: number; broke: boolean }): { scale: number; alpha: number } | null {
  if (o.on) {
    const blink = o.leftMs !== null && o.leftMs < SHIELD_WARN_MS
    const dim = blink && Math.floor((o.leftMs! / 1000) * SHIELD_BLINK_HZ * 2) % 2 === 1
    return { scale: 1, alpha: dim ? 0.35 : 1 }
  }
  const ms = Math.max(0, o.offMs)
  if (o.broke) {
    const t = ms / SHIELD_BREAK_MS
    return t >= 1 ? null : { scale: 1 + 0.25 * t, alpha: 1 - t }
  }
  const t = ms / SHIELD_FADE_MS
  return t >= 1 ? null : { scale: 1, alpha: 1 - t }
}

// ---- 落地（§8 #12）、換圈浮字（§8 #14）、彩帶（§8 #15）、鏡頭微震（§8 #16）、加速菇（§8 #18） ----

export const LAND_MS = 220

export const landSquash = (ms: number): { sy: number; sxz: number } => squashPose(ms / LAND_MS, 0.2)

/** 0 → peak → 1：前 70% easeOut 衝到 peak，後 30% 線性回 1 */
function overshoot(u: number, peak: number): number {
  return u < 0.7 ? peak * easeOut(u / 0.7) : peak - (peak - 1) * ((u - 0.7) / 0.3)
}

const CARD_POP_MS = 220
const CARD_HOLD_MS = 700
const CARD_LEAVE_MS = 300
export const LAP_CARD_MS = CARD_POP_MS + CARD_HOLD_MS + CARD_LEAVE_MS

export function lapCardPose(ms: number): { scale: number; rise: number; alpha: number } | null {
  if (!(ms >= 0 && ms < LAP_CARD_MS)) return null
  if (ms < CARD_POP_MS) return { scale: overshoot(ms / CARD_POP_MS, 1.15), rise: 0, alpha: 1 }
  if (ms < CARD_POP_MS + CARD_HOLD_MS) return { scale: 1, rise: 0, alpha: 1 }
  const u = (ms - CARD_POP_MS - CARD_HOLD_MS) / CARD_LEAVE_MS
  return { scale: 1, rise: 0.6 * u, alpha: 1 - u }
}

export const finishConfetti = (self: boolean): number => (self ? 60 : 20)
export const FINISH_FX_MS = 1600

export const SHAKE_MS = 220
export const SHAKE_AMP = 0.18

/** 線性衰減的振幅；不在 0..SHAKE_MS 內為 0 */
export function shakeAmp(ms: number): number {
  return ms >= 0 && ms < SHAKE_MS ? SHAKE_AMP * (1 - ms / SHAKE_MS) : 0
}

export const shakeAllowed = (o: { reducedMotion: boolean; mobile: boolean }): boolean => !o.reducedMotion && !o.mobile

const MUSH_POP_MS = 160
const MUSH_HOLD_MS = 80
const MUSH_SINK_MS = 100
export const MUSHROOM_MS = MUSH_POP_MS + MUSH_HOLD_MS + MUSH_SINK_MS

/** 加速菇：車頂彈出 0 → 1.2 → 1、停一下、往下縮進車身（sink 0..1） */
export function mushroomPose(ms: number): { scale: number; sink: number } | null {
  if (!(ms >= 0 && ms < MUSHROOM_MS)) return null
  if (ms < MUSH_POP_MS) return { scale: overshoot(ms / MUSH_POP_MS, 1.2), sink: 0 }
  if (ms < MUSH_POP_MS + MUSH_HOLD_MS) return { scale: 1, sink: 0 }
  const u = (ms - MUSH_POP_MS - MUSH_HOLD_MS) / MUSH_SINK_MS
  return { scale: 1 - u, sink: u }
}

/**
 * 衝線彩帶觸發（§8 #15）：每幀都記下各車 fin，只在比賽中、且上一筆明確是 null 時才算剛過線。
 * 重開局時他車快照還留著上一局的 fin（ownership 快照不會清），倒數期間先記下舊值，進比賽也不會誤播。
 */
export function finishEdges(prev: Map<string, number | null>, cars: readonly { id: string; fin: number | null }[], live: boolean): string[] {
  const out: string[] = []
  for (const c of cars) {
    if (live && prev.has(c.id) && prev.get(c.id) === null && c.fin !== null) out.push(c.id)
    prev.set(c.id, c.fin)
  }
  return out
}
