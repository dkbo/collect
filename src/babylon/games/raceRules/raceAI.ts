/**
 * 賽車電腦對手（純函式，host 每 tick 對每台 bot 呼叫；數值見 spec §2.3）。
 *
 * - 轉向：中心線 s + AI_LOOKAHEAD 取目標點，彎道往內偏 AI_LINE_OFFSET；路面外改朝 s + 4 的中心
 * - 速度：s+4..s+20 的最大 |κ| 換成目標速度 AI_CORNER_K / |κ|，超過收油、超過 +3 煞車
 * - 甩尾：只在 course.driftZones（spec 的長彎）內按住
 * - 道具：依 spec 條件使用，撿到後至少等 itemDelayMs
 * 失誤（雜訊、走大線、晚煞車、放甩尾時機、跳過甩尾、道具延遲）都放在 BotMind，由 seed 化亂數推進，不碰 Math.random。
 */
import { DRIFT_MIN_SPEED, MAX_SPEED } from '@/babylon/games/raceRules/drive'
import type { ItemKind } from '@/babylon/games/raceRules/items'
import { LONG_CORNER_K, curvatureAt, placeAt, wrapAngle, type Course } from '@/babylon/games/raceRules/track'

export const AI_LOOKAHEAD = 8
export const AI_CORNER_K = 1.5
/** 彎前限速掃描範圍 s + FROM .. s + TO */
export const AI_CORNER_FROM = 4
export const AI_CORNER_TO = 20
/** 超過目標速度多少才煞車（其間只收油） */
export const AI_BRAKE_MARGIN = 3
export const AI_LINE_OFFSET = 1.5
export const AI_STEER_GAIN = 2.2
/** 晚煞車失誤：限速掃描往後挪幾單位 */
export const AI_LATE_BRAKE = 6
/** 長彎 [s0 − IN, s1 − OUT] 按住甩尾 */
export const AI_DRIFT_IN = 4
export const AI_DRIFT_OUT = 6
/** 路面外的回正目標距離 */
export const AI_RECOVER_LOOK = 4

// 道具使用條件（spec §2.3）
export const AI_BANANA_BEHIND = 12
export const AI_BANANA_LAT = 3
export const AI_BANANA_HOLD_MS = 8000
export const AI_SHELL_RANGE = 40
export const AI_SHELL_STRAIGHT_RANGE = 20
export const AI_STRAIGHT_LOOK = 25
export const AI_STRAIGHT_K = 1 / 40

/** 失誤參數（spec §2.3） */
export const AI_ERR = {
  steerNoise: 0.12,
  noiseHoldMs: 400,
  mistakeRatePerSec: 0.05,
  mistakeMs: 700,
  mistakeLateral: 4,
  lateBrakeChance: 0.15,
  driftReleaseJitterMs: 250,
  driftSkipChance: 0.2,
  itemDelayMs: [300, 1200],
} as const

/** mulberry32：回傳 [0,1) 亂數與下一個 seed */
export function nextRand(seed: number): [number, number] {
  const t = (seed + 0x6d2b79f5) | 0
  let r = Math.imul(t ^ (t >>> 15), 1 | t)
  r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r
  return [((r ^ (r >>> 14)) >>> 0) / 4294967296, t]
}

/** 一台 bot 的「個性」狀態：雜訊、失誤、每區擲一次的骰、道具持有計時 */
export interface BotMind {
  seed: number
  noiseFrom: number
  noiseTo: number
  noiseMs: number
  /** 走大線失誤剩餘 */
  mistakeMs: number
  /** 上次擲骰的檢查點區（−1 = 尚未） */
  sector: number
  lateBrake: boolean
  skipDrift: boolean
  releaseJitterMs: number
  held: ItemKind | null
  heldMs: number
  itemDelayMs: number
}

export function makeBotMind(seed: number): BotMind {
  return {
    seed: seed | 0,
    noiseFrom: 0,
    noiseTo: 0,
    noiseMs: 0,
    mistakeMs: 0,
    sector: -1,
    lateBrake: false,
    skipDrift: false,
    releaseJitterMs: 0,
    held: null,
    heldMs: 0,
    itemDelayMs: 0,
  }
}

/** 推進失誤與道具計時；進到新的檢查點區時重擲 lateBrake／skipDrift／放甩尾時機 */
export function stepBotMind(m: BotMind, info: { sector: number; item: ItemKind | null }, dtMs: number): BotMind {
  let seed = m.seed
  const rand = () => {
    const [v, next] = nextRand(seed)
    seed = next
    return v
  }
  const n = { ...m }
  n.noiseMs += dtMs
  if (n.noiseMs >= AI_ERR.noiseHoldMs) {
    n.noiseMs -= AI_ERR.noiseHoldMs
    n.noiseFrom = n.noiseTo
    n.noiseTo = rand() * 2 - 1
  }
  if (n.mistakeMs > 0) n.mistakeMs = Math.max(0, n.mistakeMs - dtMs)
  else if (rand() < (AI_ERR.mistakeRatePerSec * dtMs) / 1000) n.mistakeMs = AI_ERR.mistakeMs
  if (info.sector !== m.sector) {
    n.sector = info.sector
    n.lateBrake = rand() < AI_ERR.lateBrakeChance
    n.skipDrift = rand() < AI_ERR.driftSkipChance
    n.releaseJitterMs = (rand() * 2 - 1) * AI_ERR.driftReleaseJitterMs
  }
  if (info.item !== m.held) {
    n.held = info.item
    n.heldMs = 0
    const [lo, hi] = AI_ERR.itemDelayMs
    n.itemDelayMs = info.item ? lo + rand() * (hi - lo) : 0
  } else if (info.item) n.heldMs += dtMs
  n.seed = seed
  return n
}

export interface BotInput {
  course: Course
  car: { x: number; z: number; ry: number; speed: number }
  s: number
  lateral: number
  /** 名次用的總沿線距離 lap·len + s（normalizeProgress 之後），others 同一套 */
  dist: number
  item: ItemKind | null
  others: readonly { dist: number; lateral: number }[]
  /** 後方 15 內有龜殼正在追自己 */
  shellChasing: boolean
  mind: BotMind
}

export interface BotOutput {
  throttle: number
  steer: number
  drift: boolean
  useItem: boolean
}

const maxAbsK = (c: Course, from: number, to: number): number => {
  let k = 0
  for (let s = from; s <= to; s += 1) k = Math.max(k, Math.abs(curvatureAt(c.track, s)))
  return k
}

function wantsItem(inp: BotInput): boolean {
  const { item, mind, course } = inp
  if (!item) return false
  if (item === 'shield' && inp.shellChasing) return true
  if (mind.heldMs < mind.itemDelayMs) return false
  const len = course.track.len
  switch (item) {
    case 'banana':
      return (
        mind.heldMs > AI_BANANA_HOLD_MS ||
        inp.others.some((o) => {
          const behind = inp.dist - o.dist
          return behind > 0 && behind <= AI_BANANA_BEHIND && Math.abs(o.lateral - inp.lateral) <= AI_BANANA_LAT
        })
      )
    case 'shell': {
      const gaps = inp.others.map((o) => o.dist - inp.dist).filter((g) => g > 0)
      if (gaps.length) return Math.min(...gaps) <= AI_SHELL_RANGE
      // 第 1 名：只對實體上就在前方的（被套圈的）車直射
      return inp.others.some((o) => {
        const ds = (((o.dist - inp.dist) % len) + len) % len
        return ds > 0 && ds <= AI_SHELL_STRAIGHT_RANGE
      })
    }
    case 'mushroom':
      return maxAbsK(course, inp.s, inp.s + AI_STRAIGHT_LOOK) < AI_STRAIGHT_K
    case 'shield':
      return true
  }
}

export function decideRaceBot(inp: BotInput): BotOutput {
  const { course, car, mind } = inp
  const { track } = course
  const offTrack = Math.abs(inp.lateral) > track.width / 2

  let target: { x: number; z: number }
  if (offTrack) {
    target = placeAt(track, inp.s + AI_RECOVER_LOOK, 0)
  } else {
    const k = curvatureAt(track, inp.s + AI_LOOKAHEAD)
    const turn = Math.abs(k) >= LONG_CORNER_K ? Math.sign(k) : 0
    const line = turn * AI_LINE_OFFSET
    const wide = mind.mistakeMs > 0 ? -(turn || 1) * AI_ERR.mistakeLateral : 0
    target = placeAt(track, inp.s + AI_LOOKAHEAD, line + wide)
  }
  const want = Math.atan2(target.x - car.x, target.z - car.z)
  const noise = offTrack ? 0 : mind.noiseFrom + (mind.noiseTo - mind.noiseFrom) * Math.min(1, mind.noiseMs / AI_ERR.noiseHoldMs)
  const steer = Math.max(-1, Math.min(1, wrapAngle(want - car.ry) * AI_STEER_GAIN + noise * AI_ERR.steerNoise))

  const shift = mind.lateBrake ? AI_LATE_BRAKE : 0
  const k = maxAbsK(course, inp.s + AI_CORNER_FROM - shift, inp.s + AI_CORNER_TO - shift)
  const vT = k > 0 ? Math.min(MAX_SPEED, AI_CORNER_K / k) : MAX_SPEED
  const throttle = offTrack ? 1 : car.speed > vT + AI_BRAKE_MARGIN ? -1 : car.speed > vT ? 0 : 1

  const release = (mind.releaseJitterMs / 1000) * Math.max(0, car.speed)
  const drift =
    !offTrack &&
    !mind.skipDrift &&
    car.speed > DRIFT_MIN_SPEED &&
    course.driftZones.some(([s0, s1]) => inp.s >= s0 - AI_DRIFT_IN && inp.s <= s1 - AI_DRIFT_OUT + release)

  return { throttle, steer, drift, useItem: wantsItem(inp) }
}
