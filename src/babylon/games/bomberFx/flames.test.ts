import { describe, expect, it } from 'vitest'
import { classifyFlameCells } from '@/babylon/games/bomberFx/flames'

describe('classifyFlameCells', () => {
  it('第一格是爆心，其餘依方向判定臂／端頭與生長順序', () => {
    const cells: [number, number][] = [[5, 5], [6, 5], [7, 5], [4, 5], [5, 6]]
    const out = classifyFlameCells(cells)
    expect(out[0]).toMatchObject({ cx: 5, cy: 5, kind: 'center', order: 0 })
    expect(out[1]).toMatchObject({ kind: 'arm', axis: 'x', dir: 1, order: 1 })
    expect(out[2]).toMatchObject({ kind: 'end', axis: 'x', dir: 1, order: 2 })
    expect(out[3]).toMatchObject({ kind: 'end', axis: 'x', dir: -1, order: 1 })
    expect(out[4]).toMatchObject({ kind: 'end', axis: 'z', dir: 1, order: 1 })
  })
  it('只有爆心的一格也能分類', () => {
    expect(classifyFlameCells([[1, 1]])).toEqual([{ cx: 1, cy: 1, kind: 'center', axis: 'x', dir: 0, order: 0 }])
  })
  it('空陣列回空', () => {
    expect(classifyFlameCells([])).toEqual([])
  })
})
