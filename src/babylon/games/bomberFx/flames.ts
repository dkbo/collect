/** 爆炸格分類（純函式）：blastCells 的 cells[0] 是爆心，其餘沿四方向延伸 */

export interface FlameCell {
  cx: number
  cy: number
  kind: 'center' | 'arm' | 'end'
  /** 臂的延伸軸（格座標 x ↔ 世界 X、y ↔ 世界 Z）；爆心固定 'x' */
  axis: 'x' | 'z'
  /** 往正或負方向延伸；爆心為 0 */
  dir: -1 | 0 | 1
  /** 離爆心的格數（依序生長用） */
  order: number
}

export function classifyFlameCells(cells: ReadonlyArray<readonly [number, number]>): FlameCell[] {
  if (cells.length === 0) return []
  const [ox, oy] = cells[0]
  const has = new Set(cells.map(([x, y]) => `${x},${y}`))
  return cells.map(([cx, cy], i) => {
    if (i === 0) return { cx, cy, kind: 'center', axis: 'x', dir: 0, order: 0 }
    const dx = Math.sign(cx - ox)
    const dy = Math.sign(cy - oy)
    const axis = dy === 0 ? 'x' : 'z'
    const dir = (axis === 'x' ? dx : dy) as -1 | 1
    const end = !has.has(`${cx + dx},${cy + dy}`)
    return { cx, cy, kind: end ? 'end' : 'arm', axis, dir, order: Math.abs(cx - ox) + Math.abs(cy - oy) }
  })
}
