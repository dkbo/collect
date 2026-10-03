import { describe, it, expect } from 'vitest'
import {
  CLOSE_INTERVAL_MS,
  CLOSE_WARN_MS,
  SUDDEN_DEATH_MS,
  closeDue,
  crushedIds,
  spiralCells,
} from '@/babylon/games/tankFx/closing'
import { GRID_H, GRID_W, cellToWorld } from '@/babylon/games/tankFx/grid'

describe('常數', () => {
  it('AC2 具名常數', () => {
    expect([SUDDEN_DEATH_MS, CLOSE_INTERVAL_MS, CLOSE_WARN_MS]).toEqual([60000, 700, 400])
  })
})

describe('spiralCells — 外圈往內螺旋', () => {
  const s = spiralCells(GRID_W, GRID_H)
  it('涵蓋每一格恰好一次', () => {
    expect(s.length).toBe(GRID_W * GRID_H)
    expect(new Set(s.map(([x, y]) => y * GRID_W + x)).size).toBe(GRID_W * GRID_H)
  })

  it('從左上角沿上排往右，外圈走完才進內圈', () => {
    expect(s.slice(0, 3)).toEqual([
      [0, 0],
      [1, 0],
      [2, 0],
    ])
    const ring = (c: readonly [number, number]) => Math.min(c[0], c[1], GRID_W - 1 - c[0], GRID_H - 1 - c[1])
    for (let i = 1; i < s.length; i++) expect(ring(s[i])).toBeGreaterThanOrEqual(ring(s[i - 1]))
  })
})

describe('crushedIds — 壓毀判定', () => {
  const at = (cx: number, cy: number, dx = 0, dz = 0) => ({ x: cellToWorld(cx, GRID_W) + dx, z: cellToWorld(cy, GRID_H) + dz })

  it('中心在落牆格內＝壓毀', () => {
    expect(crushedIds(3, 0, [{ id: 'a', ...at(3, 0, 0.9, -0.9) }])).toEqual(['a'])
  })

  it('中心在相鄰格＝不壓毀（車身擦到也不算）', () => {
    expect(crushedIds(3, 0, [{ id: 'b', ...at(4, 0, -0.95) }, { id: 'c', ...at(3, 1) }])).toEqual([])
  })
})

describe('closeDue — 落牆時機', () => {
  const base = { playingSince: 1000, lastClose: 0 }
  it('未進 playing 不落', () => {
    expect(closeDue({ now: 999_999, playingSince: 0, lastClose: 0 })).toBe(false)
  })

  it('滿 SUDDEN_DEATH_MS 才開始', () => {
    expect(closeDue({ ...base, now: 1000 + SUDDEN_DEATH_MS - 1 })).toBe(false)
    expect(closeDue({ ...base, now: 1000 + SUDDEN_DEATH_MS })).toBe(true)
  })

  it('之後每 CLOSE_INTERVAL_MS 一面', () => {
    const last = 1000 + SUDDEN_DEATH_MS
    expect(closeDue({ ...base, lastClose: last, now: last + CLOSE_INTERVAL_MS - 1 })).toBe(false)
    expect(closeDue({ ...base, lastClose: last, now: last + CLOSE_INTERVAL_MS })).toBe(true)
  })
})
