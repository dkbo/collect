/**
 * 縮圈突然死亡（純函式）。落牆序列、預告與「下一面落點」沿用 bomberFx/suddenDeath 的
 * nextCloseCell／closeWarningActive（只讀 import），這裡補坦克專屬的螺旋、時機與壓毀判定。
 */
import { GRID_H, GRID_W, worldToCell } from '@/babylon/games/tankFx/grid'

/** 進 playing 滿此時間後開始縮圈 */
export const SUDDEN_DEATH_MS = 60000
/** 每面牆落下的間隔 */
export const CLOSE_INTERVAL_MS = 700
/** 落牆前的地面紅色預告時間 */
export const CLOSE_WARN_MS = 400

/** 由外圈往內、順時針的螺旋格序列（左上角起沿上排往右），各端決定性一致 */
export function spiralCells(w: number, h: number): [number, number][] {
  const cells: [number, number][] = []
  let top = 0
  let bottom = h - 1
  let left = 0
  let right = w - 1
  while (top <= bottom && left <= right) {
    for (let cx = left; cx <= right; cx++) cells.push([cx, top])
    for (let cy = top + 1; cy <= bottom; cy++) cells.push([right, cy])
    if (top < bottom) for (let cx = right - 1; cx >= left; cx--) cells.push([cx, bottom])
    if (left < right) for (let cy = bottom - 1; cy > top; cy--) cells.push([left, cy])
    top++
    bottom--
    left++
    right--
  }
  return cells
}

/** host：是否該落下一面牆（首面 = playingSince + SUDDEN_DEATH_MS，之後每 CLOSE_INTERVAL_MS） */
export function closeDue(o: { now: number; playingSince: number; lastClose: number }): boolean {
  if (o.playingSince === 0) return false
  const nextAt = o.lastClose !== 0 ? o.lastClose + CLOSE_INTERVAL_MS : o.playingSince + SUDDEN_DEATH_MS
  return o.now >= nextAt
}

/** 坦克中心所在格等於落牆格者被壓毀（車身擦到相鄰格不算） */
export function crushedIds(cx: number, cy: number, tanks: readonly { id: string; x: number; z: number }[]): string[] {
  return tanks.filter((t) => worldToCell(t.x, GRID_W) === cx && worldToCell(t.z, GRID_H) === cy).map((t) => t.id)
}
