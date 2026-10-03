/**
 * 坦克場地格線（純函式，node 可單測）。場地常數原樣搬自 tank.ts，數值不變。
 */

export const CELL = 2
export const GRID_W = 16
export const GRID_H = 16
/** 坦克佔位半徑（碰撞以中心 ±R 的四個角落取格） */
export const TANK_RADIUS = 0.5

export type CellPred = (cx: number, cy: number) => boolean

export const cellToWorld = (c: number, count: number): number => (c - (count - 1) / 2) * CELL
export const worldToCell = (w: number, count: number): number => Math.round(w / CELL + (count - 1) / 2)
export const cellIdx = (cx: number, cy: number): number => cy * GRID_W + cx
export const inGrid = (cx: number, cy: number): boolean => cx >= 0 && cx < GRID_W && cy >= 0 && cy < GRID_H

/** 坦克中心在 (x, z) 時是否會卡進 blocked 格或出場。
 *  正式碼移動一律走 tankMoveBlocked（落牆擦到的坦克要能脫困）；這支只留作單測的佔位基準。 */
export const tankBlocked = (x: number, z: number, blocked: CellPred): boolean => {
  for (const ox of [-TANK_RADIUS, TANK_RADIUS]) {
    for (const oz of [-TANK_RADIUS, TANK_RADIUS]) {
      const cx = worldToCell(x + ox, GRID_W)
      const cy = worldToCell(z + oz, GRID_H)
      if (!inGrid(cx, cy) || blocked(cx, cy)) return true
    }
  }
  return false
}

/** 坦克方框（中心 ±R）與某格方框的重疊面積 */
const overlapArea = (x: number, z: number, cx: number, cy: number): number => {
  const gx = cellToWorld(cx, GRID_W)
  const gz = cellToWorld(cy, GRID_H)
  const ox = Math.min(x + TANK_RADIUS, gx + CELL / 2) - Math.max(x - TANK_RADIUS, gx - CELL / 2)
  const oz = Math.min(z + TANK_RADIUS, gz + CELL / 2) - Math.max(z - TANK_RADIUS, gz - CELL / 2)
  return ox > 0 && oz > 0 ? ox * oz : 0
}

/**
 * 移動判定：只擋「新碰到、或更深入」的阻擋格（含場外）。
 * 落牆時車身已擦進該格的坦克（中心在相鄰格，不算壓毀）仍可往外或沿牆移動，不會永久卡死。
 */
export const tankMoveBlocked = (fx: number, fz: number, tx: number, tz: number, blocked: CellPred): boolean => {
  const seen = new Set<string>()
  for (const [x, z] of [
    [fx, fz],
    [tx, tz],
  ]) {
    for (const ox of [-TANK_RADIUS, TANK_RADIUS]) {
      for (const oz of [-TANK_RADIUS, TANK_RADIUS]) {
        const cx = worldToCell(x + ox, GRID_W)
        const cy = worldToCell(z + oz, GRID_H)
        const key = `${cx},${cy}`
        if (seen.has(key)) continue
        seen.add(key)
        if (inGrid(cx, cy) && !blocked(cx, cy)) continue
        if (overlapArea(tx, tz, cx, cy) > overlapArea(fx, fz, cx, cy) + 1e-9) return true
      }
    }
  }
  return false
}
