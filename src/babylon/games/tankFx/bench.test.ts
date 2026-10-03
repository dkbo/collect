import { describe, expect, it } from 'vitest'
import { BENCH_BULLETS, benchEnabled, benchLayout } from '@/babylon/games/tankFx/bench'
import { ITEM_KINDS } from '@/babylon/games/tankFx/combat'
import { GRID_H, GRID_W } from '@/babylon/games/tankFx/grid'

describe('benchEnabled（?tankBench=1 只在 tankNoDegrade=1 下生效）', () => {
  it('兩個都給才開', () => {
    expect(benchEnabled('?tankBench=1&tankNoDegrade=1')).toBe(true)
  })
  it('只給 tankBench 不開', () => {
    expect(benchEnabled('?tankBench=1')).toBe(false)
    expect(benchEnabled('?tankBench=1&tankNoDegrade=0')).toBe(false)
  })
  it('沒給不開', () => {
    expect(benchEnabled('')).toBe(false)
    expect(benchEnabled('?tankNoDegrade=1')).toBe(false)
  })
})

describe('benchLayout（5 種道具各一＋10 顆靜止子彈）', () => {
  const blocked = (cx: number, cy: number) => cx % 2 === 1 && cy % 2 === 1
  const lay = benchLayout(blocked)
  it('五種道具各一個，不重格、不在阻擋格', () => {
    expect(lay.items.map((i) => i.kind).sort()).toEqual([...ITEM_KINDS].sort())
    const cells = new Set(lay.items.map((i) => `${i.cx},${i.cy}`))
    expect(cells.size).toBe(5)
    for (const i of lay.items) {
      expect(blocked(i.cx, i.cy)).toBe(false)
      expect(i.cx >= 0 && i.cx < GRID_W && i.cy >= 0 && i.cy < GRID_H).toBe(true)
    }
  })
  it('10 顆子彈，不在阻擋格、不與道具同格', () => {
    expect(lay.bullets).toHaveLength(BENCH_BULLETS)
    expect(BENCH_BULLETS).toBe(10)
    const itemCells = new Set(lay.items.map((i) => `${i.cx},${i.cy}`))
    for (const b of lay.bullets) {
      expect(blocked(b.cx, b.cy)).toBe(false)
      expect(itemCells.has(`${b.cx},${b.cy}`)).toBe(false)
    }
  })
  it('同輸入同輸出（決定性）', () => {
    expect(benchLayout(blocked)).toEqual(lay)
  })
})
