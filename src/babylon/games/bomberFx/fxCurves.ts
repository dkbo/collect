/**
 * 炸彈超人特效的時間曲線（spec §8，純函式，可在 node 單測）。
 * t 一律是 0..1 的進度（呼叫端用 經過毫秒 / 時長 算），超出範圍自動夾住。
 */

const clamp01 = (t: number): number => (t <= 0 ? 0 : t >= 1 ? 1 : t)
const easeOut = (t: number): number => 1 - (1 - t) * (1 - t)

/** back-out：衝過 1 再回到 1 */
export function backOut(t: number): number {
  const s = 1.70158
  const u = clamp01(t) - 1
  return 1 + (s + 1) * u * u * u + s * u * u
}

/** 放炸彈：縮放 0.6 → 1.0（back-out） */
export function placeScale(t: number): number {
  if (t >= 1) return 1
  return 0.6 + 0.4 * backOut(t)
}

/** 爆炸臂依序生長：每離爆心一格延遲 25ms */
export const ARM_STEP_MS = 25
export function armDelayMs(cx: number, cy: number, ccx: number, ccy: number): number {
  return (Math.abs(cx - ccx) + Math.abs(cy - ccy)) * ARM_STEP_MS
}

/** 火焰 emissive：1.0 → 0.4 */
export function flameEmissive(ageMs: number, lifeMs: number): number {
  return 1 - 0.6 * clamp01(ageMs / lifeMs)
}

/** 陣亡：往上跳（前 70% 走一個弧）、旋轉加速、縮小到 0 */
export function deathPose(t: number): { lift: number; spin: number; scale: number } {
  const u = clamp01(t)
  if (u === 0) return { lift: 0, spin: 0, scale: 1 }
  const hop = Math.min(1, u / 0.7)
  return {
    lift: 1.6 * Math.sin(Math.PI * hop) * (1 - 0.4 * u),
    spin: Math.PI * 4 * u * u,
    scale: 1 - u * u,
  }
}

/** 道具出現：往上彈 0.4 CELL 再落回，同時轉一整圈 */
export function itemHop(t: number, cell: number): { lift: number; spin: number } {
  if (t >= 1 + 1e-9 || t < 0) return { lift: 0, spin: 0 }
  const u = clamp01(t)
  return { lift: 0.4 * cell * Math.sin(Math.PI * u), spin: Math.PI * 2 * easeOut(u) }
}

/** 拾取：位置插值（先慢後快，像被吸過去）、縮放 1 → 0 */
export function pickupFlight(t: number): { k: number; scale: number } {
  const u = clamp01(t)
  return { k: u * u, scale: 1 - u }
}

/** 地面 ring：擴散 0.35 → 1.25（相對一格），同時淡出 */
export function ringPose(t: number): { scale: number; alpha: number } {
  const u = clamp01(t)
  return { scale: 0.35 + 0.9 * easeOut(u), alpha: 0.9 * (1 - u) }
}

/** 飄字（+1）：往上飄 0.9，前 40% 不透明、之後淡出 */
export function floatTextPose(t: number): { rise: number; alpha: number } {
  const u = clamp01(t)
  return { rise: 0.9 * easeOut(u), alpha: u < 0.4 ? 1 : 1 - (u - 0.4) / 0.6 }
}

/** 焦痕：前段維持原大小，最後 400ms 縮到 0（thin instance 沒有逐顆 alpha，用縮小代替淡出） */
export const SCORCH_FADE_MS = 400
export function scorchScale(ageMs: number, lifeMs: number): number {
  const left = lifeMs - ageMs
  if (left <= 0) return 0
  return Math.min(1, left / SCORCH_FADE_MS)
}

/** 連續發射：每秒 rate 顆，小數累積到下一幀；單幀最多算 100ms（切分頁回來不會一次噴爆） */
export function emitCount(acc: number, rate: number, dtMs: number): { count: number; acc: number } {
  const total = acc + (rate * Math.min(dtMs, 100)) / 1000
  const count = Math.floor(total + 1e-9)
  return { count, acc: total - count }
}
