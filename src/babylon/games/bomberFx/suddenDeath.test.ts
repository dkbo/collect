import { describe, expect, it } from 'vitest'
import { closeWarningActive, nextCloseCell } from '@/babylon/games/bomberFx/suddenDeath'

describe('nextCloseCell', () => {
  const spiral: [number, number][] = [[0, 0], [1, 0], [2, 0]]
  it('從指定 index 往後找第一個尚非牆的格', () => {
    const walls = new Set(['1,0'])
    expect(nextCloseCell(spiral, (x, y) => walls.has(`${x},${y}`), 1)).toEqual({ index: 2, cx: 2, cy: 0 })
  })
  it('走完回 null', () => {
    expect(nextCloseCell(spiral, () => true, 0)).toBeNull()
    expect(nextCloseCell(spiral, () => false, 3)).toBeNull()
  })
})

describe('closeWarningActive', () => {
  const o = { suddenMs: 40000, intervalMs: 650, leadMs: 400 }
  it('未開局（playingSince=0）不預告', () => {
    expect(closeWarningActive({ ...o, now: 50000, playingSince: 0, lastClose: 0 })).toBe(false)
  })
  it('第一面牆：playingSince+40s 前 400ms 內預告', () => {
    expect(closeWarningActive({ ...o, now: 1000 + 40000 - 401, playingSince: 1000, lastClose: 0 })).toBe(false)
    expect(closeWarningActive({ ...o, now: 1000 + 40000 - 399, playingSince: 1000, lastClose: 0 })).toBe(true)
  })
  it('之後每面牆：lastClose+650 前 400ms 內預告', () => {
    expect(closeWarningActive({ ...o, now: 60000 + 200, playingSince: 1000, lastClose: 60000 })).toBe(false)
    expect(closeWarningActive({ ...o, now: 60000 + 300, playingSince: 1000, lastClose: 60000 })).toBe(true)
  })
  it('過了預定時間仍未落（網路延遲）持續預告，直到落牆更新 lastClose', () => {
    expect(closeWarningActive({ ...o, now: 60000 + 900, playingSince: 1000, lastClose: 60000 })).toBe(true)
  })
})
