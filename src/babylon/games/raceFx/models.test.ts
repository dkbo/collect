import { describe, it, expect } from 'vitest'
import type { MeshData } from '@/babylon/fx/geometry'
import {
  BOX_SIZE,
  WHEELS,
  archData,
  bananaData,
  blockData,
  boxData,
  carBodyData,
  coneData,
  crowdData,
  curbData,
  flagData,
  mushroomData,
  rampData,
  shellData,
  standData,
  treeData,
  wheelData,
} from '@/babylon/games/raceFx/models'

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

function bounds(d: MeshData): { min: number[]; max: number[] } {
  const min = [Infinity, Infinity, Infinity]
  const max = [-Infinity, -Infinity, -Infinity]
  for (let i = 0; i < d.positions.length; i += 3) {
    for (let k = 0; k < 3; k++) {
      min[k] = Math.min(min[k], d.positions[i + k])
      max[k] = Math.max(max[k], d.positions[i + k])
    }
  }
  return { min, max }
}

describe('raceFx/models — 玩具車（spec §4.1）', () => {
  it('4 色真人與 bot 車身都是合法 mesh、帶頂點色', () => {
    for (const ci of [0, 1, 2, 3] as const) {
      for (const bot of [false, true]) {
        const d = carBodyData(ci, bot)
        expectWellFormed(d)
        expect(d.colors).toBeDefined()
      }
    }
  })

  it('外接框約 1.6 寬 × 2.3 長，車頭朝 +z、原點在地面', () => {
    const b = bounds(carBodyData(0, false))
    expect(b.max[0]).toBeLessThanOrEqual(0.8)
    expect(b.min[0]).toBeGreaterThanOrEqual(-0.8)
    expect(b.max[2]).toBeGreaterThan(1.1)
    expect(b.max[2]).toBeLessThanOrEqual(1.25)
    expect(b.min[2]).toBeGreaterThanOrEqual(-1.25)
    expect(b.min[1]).toBeGreaterThanOrEqual(0)
    // 安全帽頂約 1.55–1.65
    expect(b.max[1]).toBeGreaterThan(1.5)
    expect(b.max[1]).toBeLessThan(1.7)
  })

  it('bot 多一根天線（比真人高）', () => {
    expect(bounds(carBodyData(1, true)).max[1]).toBeGreaterThan(bounds(carBodyData(1, false)).max[1] + 0.15)
  })

  it('4 個輪位：前輪 z>0、後輪 z<0 且放大 1.08；輪胎模型軸向沿 x、直徑約 0.62', () => {
    expect(WHEELS).toHaveLength(4)
    expect(WHEELS.filter((w) => w.front && w.z > 0)).toHaveLength(2)
    expect(WHEELS.filter((w) => !w.front && w.z < 0 && w.scale === 1.08)).toHaveLength(2)
    const d = wheelData()
    expectWellFormed(d)
    const b = bounds(d)
    expect(b.max[1] - b.min[1]).toBeCloseTo(0.62, 1)
    expect(b.max[2] - b.min[2]).toBeCloseTo(0.62, 1)
    expect(b.max[0] - b.min[0]).toBeLessThan(0.45)
  })
})

describe('raceFx/models — 道具與道具箱（spec §4.2）', () => {
  it('道具箱 1.3 立方，6 面 uv 落在 4 格圖集內', () => {
    const d = boxData()
    expectWellFormed(d)
    const b = bounds(d)
    expect(b.max[0] - b.min[0]).toBeCloseTo(BOX_SIZE, 2)
    expect(BOX_SIZE).toBe(1.3)
    for (let i = 0; i < d.uvs.length; i += 2) {
      expect(d.uvs[i]).toBeGreaterThanOrEqual(0)
      expect(d.uvs[i]).toBeLessThanOrEqual(1)
    }
    // 至少用到 3 格（對面同色）
    const cells = new Set<number>()
    for (let i = 0; i < d.uvs.length; i += 2) cells.add(Math.max(0, Math.floor(d.uvs[i] * 4 - 1e-6)))
    expect(cells.size).toBeGreaterThanOrEqual(3)
  })

  it('香蕉貼地約 1.0×0.4×1.0、龜殼約 0.9 寬', () => {
    const ba = bananaData()
    expectWellFormed(ba)
    const bb = bounds(ba)
    expect(bb.min[1]).toBeGreaterThanOrEqual(-0.01)
    expect(bb.max[1]).toBeLessThan(0.6)
    expect(bb.max[0] - bb.min[0]).toBeGreaterThan(0.7)
    expect(bb.max[0] - bb.min[0]).toBeLessThan(1.2)
    const sh = shellData()
    expectWellFormed(sh)
    const sb = bounds(sh)
    expect(sb.max[0] - sb.min[0]).toBeGreaterThan(0.85)
    expect(sb.max[0] - sb.min[0]).toBeLessThan(1.15)
  })
})

describe('raceFx/models — 場景物件（spec §4.3）', () => {
  it('積木、路緣、觀眾、樹、錐、旗面、看台、拱門都是合法 mesh', () => {
    for (const d of [
      blockData('2x2'),
      blockData('2x4'),
      curbData(),
      crowdData(),
      treeData(),
      coneData(),
      flagData(),
      standData(40),
      archData(),
    ])
      expectWellFormed(d)
  })

  it('2×4 積木長是 2×2 的兩倍', () => {
    const a = bounds(blockData('2x2'))
    const b = bounds(blockData('2x4'))
    expect(b.max[0] - b.min[0]).toBeCloseTo(2 * (a.max[0] - a.min[0]), 1)
  })

  it('跳台楔形：前緣近地、後緣（唇口）高 h，長 len、寬 w', () => {
    const d = rampData(6, 8, 1.1)
    expectWellFormed(d)
    const b = bounds(d)
    expect(b.max[2] - b.min[2]).toBeGreaterThanOrEqual(6)
    expect(b.max[0] - b.min[0]).toBeGreaterThanOrEqual(8)
    expect(b.max[1]).toBeGreaterThanOrEqual(1.1)
    // 前緣（z 最小）的頂點都很低
    for (let i = 0; i < d.positions.length; i += 3) {
      if (d.positions[i + 2] < b.min[2] + 0.01) expect(d.positions[i + 1]).toBeLessThan(0.1)
    }
  })
})

describe('raceFx/models — 加速菇（spec §4.2）', () => {
  it('合法 mesh、原點在柄底、傘寬約 0.7、總高約 0.6', () => {
    const d = mushroomData()
    expectWellFormed(d)
    const b = bounds(d)
    expect(b.min[1]).toBeGreaterThanOrEqual(-0.01)
    expect(b.max[0] - b.min[0]).toBeGreaterThan(0.65)
    expect(b.max[0] - b.min[0]).toBeLessThan(0.8)
    expect(b.max[1]).toBeGreaterThan(0.5)
    expect(b.max[1]).toBeLessThan(0.75)
  })
})
