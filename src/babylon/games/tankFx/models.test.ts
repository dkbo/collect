import { describe, it, expect } from 'vitest'
import type { MeshData } from '@/babylon/fx/geometry'
import {
  BARREL_Y,
  BORDER_COLORS,
  CLOSE_COLORS,
  MUZZLE_Z,
  TURRET_PIVOT_Z,
  WALL_COLORS,
  brickData,
  bulletData,
  hullData,
  turretMeshData,
} from '@/babylon/games/tankFx/models'

/** 頂點陣列長度一致、索引都在範圍內且為三角形 */
function expectWellFormed(d: MeshData): void {
  const n = d.positions.length / 3
  expect(Number.isInteger(n)).toBe(true)
  expect(n).toBeGreaterThan(0)
  expect(d.normals.length).toBe(d.positions.length)
  expect(d.uvs.length).toBe(n * 2)
  if (d.colors) expect(d.colors.length).toBe(n * 4)
  expect(d.indices.length % 3).toBe(0)
  expect(Math.max(...d.indices)).toBeLessThan(n)
  expect(Math.min(...d.indices)).toBeGreaterThanOrEqual(0)
  expect(d.positions.every(Number.isFinite)).toBe(true)
}

describe('tankFx/models — 程式建模資料完整', () => {
  it('4 色車身與砲塔（真人與 bot）都是合法 mesh', () => {
    for (const ci of [0, 1, 2, 3] as const) {
      expectWellFormed(hullData(ci))
      for (const isBot of [false, true]) expectWellFormed(turretMeshData(ci, isBot).data)
    }
  })

  it('三種積木牆與子彈是合法 mesh', () => {
    for (const c of [WALL_COLORS, BORDER_COLORS, CLOSE_COLORS]) expectWellFormed(brickData(c))
    expectWellFormed(bulletData())
  })

  it('砲口在車心前方約 1 格半徑處、高度同砲管（tank.ts 砲口焰位置由此推導）', () => {
    expect(TURRET_PIVOT_Z + MUZZLE_Z).toBeGreaterThan(0.9)
    expect(TURRET_PIVOT_Z + MUZZLE_Z).toBeLessThan(1.1)
    expect(BARREL_Y).toBeGreaterThan(0)
  })
})
