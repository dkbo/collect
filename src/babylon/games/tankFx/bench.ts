/**
 * 效能量測場景（AC10 N1，純函式）：`?tankBench=1` 且 `?tankNoDegrade=1` 時，場上擺 5 種道具各一、10 顆靜止子彈。
 * 只是視覺擺設（不進遊戲邏輯、撿不到也不會動），用來固定 draw call 的量測條件。
 */
import { ITEM_KINDS, type ItemKind } from '@/babylon/games/tankFx/combat'
import { GRID_H, GRID_W, type CellPred } from '@/babylon/games/tankFx/grid'

export const BENCH_BULLETS = 10

export interface BenchLayout {
  items: { kind: ItemKind; cx: number; cy: number }[]
  bullets: { cx: number; cy: number }[]
}

/** search 為合併過 hash 的 query（fx/quality 的 tierQuery） */
export function benchEnabled(search: string): boolean {
  const q = new URLSearchParams(search)
  return q.get('tankBench') === '1' && q.get('tankNoDegrade') === '1'
}

/** 從場地中央一列往外找空格：道具放第 7 列、子彈放第 8 列（決定性，各端一致） */
export function benchLayout(blocked: CellPred): BenchLayout {
  const used = new Set<string>()
  const take = (rows: number[], n: number): { cx: number; cy: number }[] => {
    const out: { cx: number; cy: number }[] = []
    for (const cy of rows) {
      for (let cx = 1; cx < GRID_W - 1 && out.length < n; cx++) {
        const k = `${cx},${cy}`
        if (used.has(k) || blocked(cx, cy)) continue
        used.add(k)
        out.push({ cx, cy })
      }
    }
    return out
  }
  const mid = Math.floor(GRID_H / 2)
  const itemCells = take([mid - 1, mid - 3, mid + 1], ITEM_KINDS.length)
  const bullets = take([mid, mid - 2, mid + 2], BENCH_BULLETS)
  return { items: itemCells.map((c, i) => ({ kind: ITEM_KINDS[i], ...c })), bullets }
}
