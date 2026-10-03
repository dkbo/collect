/**
 * 玩具系列特效的通用時間曲線（純函式，可在 node 單測；bomber 與 kitchen 共用）。
 * t 一律是 0..1 的進度（呼叫端用 經過毫秒 / 時長 算），超出範圍自動夾住。
 */

export const clamp01 = (t: number): number => (t <= 0 ? 0 : t >= 1 ? 1 : t)
export const easeOut = (t: number): number => 1 - (1 - t) * (1 - t)

/** back-out：衝過 1 再回到 1 */
export function backOut(t: number): number {
  const s = 1.70158
  const u = clamp01(t) - 1
  return 1 + (s + 1) * u * u * u + s * u * u
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

/**
 * 以 aim 為軸、半角 cone 內取一個方向（r1 決定偏離角、r2 決定繞軸角，皆 ∈ [0,1)），回傳單位向量；
 * aim 長度為 0 時往上。砲口火花、反彈火花用。
 */
export function coneDirection(aim: readonly [number, number, number], cone: number, r1: number, r2: number): [number, number, number] {
  const len = Math.hypot(aim[0], aim[1], aim[2])
  if (len < 1e-9) return [0, 1, 0]
  const a = [aim[0] / len, aim[1] / len, aim[2] / len]
  // 與 aim 不平行的輔助軸 → 兩條正交基底 u、v
  const h = Math.abs(a[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0]
  let u = [a[1] * h[2] - a[2] * h[1], a[2] * h[0] - a[0] * h[2], a[0] * h[1] - a[1] * h[0]]
  const ul = Math.hypot(u[0], u[1], u[2])
  u = [u[0] / ul, u[1] / ul, u[2] / ul]
  const v = [a[1] * u[2] - a[2] * u[1], a[2] * u[0] - a[0] * u[2], a[0] * u[1] - a[1] * u[0]]
  const th = cone * r1
  const ph = Math.PI * 2 * r2
  const c = Math.cos(th)
  const s = Math.sin(th)
  const out: [number, number, number] = [0, 0, 0]
  for (let i = 0; i < 3; i++) out[i] = a[i] * c + (u[i] * Math.cos(ph) + v[i] * Math.sin(ph)) * s
  return out
}

/** 連續發射：每秒 rate 顆，小數累積到下一幀；單幀最多算 100ms（切分頁回來不會一次噴爆） */
export function emitCount(acc: number, rate: number, dtMs: number): { count: number; acc: number } {
  const total = acc + (rate * Math.min(dtMs, 100)) / 1000
  const count = Math.floor(total + 1e-9)
  return { count, acc: total - count }
}
