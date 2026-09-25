/** 突然死亡落牆預告（純函式）：落牆前 leadMs 在地上畫紅色預告格 */

/** 從 fromIndex 起沿螺旋找第一個尚非牆的格 */
export function nextCloseCell(
  spiral: ReadonlyArray<readonly [number, number]>,
  isWall: (cx: number, cy: number) => boolean,
  fromIndex: number
): { index: number; cx: number; cy: number } | null {
  for (let i = Math.max(0, fromIndex); i < spiral.length; i++) {
    const [cx, cy] = spiral[i]
    if (!isWall(cx, cy)) return { index: i, cx, cy }
  }
  return null
}

/** 下一面牆預定落下前 leadMs 起（含延遲未到的時段）為 true。
 *  預定時刻與 host tickSuddenDeath 相同：首面 = playingSince + suddenMs，之後 = lastClose + intervalMs。 */
export function closeWarningActive(o: {
  now: number
  playingSince: number
  lastClose: number
  suddenMs: number
  intervalMs: number
  leadMs: number
}): boolean {
  if (o.playingSince === 0) return false
  const nextAt = o.lastClose !== 0 ? o.lastClose + o.intervalMs : o.playingSince + o.suddenMs
  return o.now >= nextAt - o.leadMs
}
