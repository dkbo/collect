import { describe, it, expect } from 'vitest'
import {
  BOOST_PADS,
  ITEM_ODDS,
  ITEM_ROWS,
  ITEM_ROW_S,
  JUMP_S0,
  JUMP_S1,
  LONG_CORNERS,
  RACE_COURSE,
  TRACK_CTRL,
  TRACK_WIDTH,
} from '@/babylon/games/raceRules/trackData'
import { ACCEL, BRAKE, MAX_SPEED } from '@/babylon/games/raceRules/drive'
import { boxLayout } from '@/babylon/games/raceRules/items'
import {
  LONG_CORNER_K,
  LONG_CORNER_MIN_LEN,
  curvatureAt,
  findLongCurves,
  pointAt,
  trackProgress,
  wrapAngle,
} from '@/babylon/games/raceRules/track'

const { track } = RACE_COURSE
const deg = (r: number) => (r * 180) / Math.PI

describe('A Toy Racer 賽道（spec §1）', () => {
  it('48 個控制點、路寬 12、總長 554.8', () => {
    expect(TRACK_CTRL).toHaveLength(48)
    expect(TRACK_WIDTH).toBe(12)
    expect(track.width).toBe(12)
    expect(track.len).toBeCloseTo(554.8, 0)
  })

  it('不自交：沿線距離 > 40 的兩點中心線距離 ≥ 25（扣路寬仍有淨距）', () => {
    const step = 2
    let min = Infinity
    for (let a = 0; a < track.len; a += step) {
      const p = pointAt(track, a)
      for (let b = a + 40; b < a + track.len - 40; b += step) {
        const q = pointAt(track, b)
        min = Math.min(min, Math.hypot(p.x - q.x, p.z - q.z))
      }
    }
    expect(min).toBeGreaterThanOrEqual(25)
  })

  it('檢查點表（spec §1.3）：座標與朝向', () => {
    const table: [number, number, number][] = [
      [-8, -72, 90], [61.3, -71.5, 81], [68.8, -13.0, -21], [45.1, 52.1, -21],
      [17.0, 39.1, 180], [-5.3, -13.8, -89], [-70.8, -2.6, -112], [-76.0, -67.2, 138],
    ]
    table.forEach(([x, z, ry], k) => {
      const p = pointAt(track, track.checkpoints[k])
      expect(Math.hypot(p.x - x, p.z - z)).toBeLessThan(0.3)
      expect(Math.abs(deg(wrapAngle(p.heading - (ry * Math.PI) / 180)))).toBeLessThan(2)
    })
  })

  it('發車格表（spec §1.3）', () => {
    const table: [number, number][] = [[-13, -69], [-17, -75], [-21, -69], [-25, -75]]
    RACE_COURSE.grid.forEach((g, i) => {
      expect(Math.hypot(g.x - table[i][0], g.z - table[i][1])).toBeLessThan(0.3)
      expect(g.ry).toBeCloseTo(Math.PI / 2, 2)
    })
  })

  it('跳台 150–156、加速帶 3 塊（spec §1.4／§1.5）', () => {
    expect([JUMP_S0, JUMP_S1]).toEqual([150, 156])
    expect(RACE_COURSE.jumps).toEqual([[150, 156]])
    const table: [number, number][] = [[67.3, -9.0], [13.8, 54.5], [-48.8, -4.5]]
    expect(BOOST_PADS).toHaveLength(3)
    RACE_COURSE.pads.forEach((p, i) => expect(Math.hypot(p.x - table[i][0], p.z - table[i][1])).toBeLessThan(0.3))
  })

  it('道具箱 3 列 × 4（spec §1.6）', () => {
    expect(ITEM_ROWS).toBe(3)
    expect(ITEM_ROW_S).toEqual([122, 295, 452])
    const table: [number, number][] = [
      [70.5, -30.1], [73.4, -29.1], [76.2, -28.1], [79.0, -27.1],
      [21.5, 21.5], [18.5, 21.5], [15.5, 21.5], [12.5, 21.5],
      [-75.5, -34.8], [-78.5, -34.8], [-81.5, -34.8], [-84.5, -34.8],
    ]
    boxLayout(RACE_COURSE).forEach((b, i) => expect(Math.hypot(b.x - table[i][0], b.z - table[i][1])).toBeLessThan(0.3))
  })

  it('長彎表與曲率掃描一致（誤差 ≤ 3），兩段都是左彎', () => {
    const scanned = findLongCurves(track, LONG_CORNER_K, LONG_CORNER_MIN_LEN)
    expect(scanned).toHaveLength(LONG_CORNERS.length)
    LONG_CORNERS.forEach((c, i) => {
      expect(Math.abs(scanned[i][0] - c.s0)).toBeLessThanOrEqual(3)
      expect(Math.abs(scanned[i][1] - c.s1)).toBeLessThanOrEqual(3)
      expect(c.dir).toBe(-1)
      expect(curvatureAt(track, (c.s0 + c.s1) / 2)).toBeLessThan(0)
    })
    expect(RACE_COURSE.driftZones).toEqual(LONG_CORNERS.map((c) => [c.s0, c.s1]))
  })

  it('形狀下限（AC1）：≥120° 大彎、左右連續 S 彎', () => {
    const t2 = LONG_CORNERS[1]
    let turn = 0
    for (let s = t2.s0; s < t2.s1; s += 0.5) turn += wrapAngle(pointAt(track, s + 0.5).heading - pointAt(track, s).heading)
    expect(Math.abs(deg(turn))).toBeGreaterThanOrEqual(120)
    expect(curvatureAt(track, 361)).toBeGreaterThan(LONG_CORNER_K) // S1 右
    expect(curvatureAt(track, 378)).toBeLessThan(-LONG_CORNER_K) // S2 左
  })

  it('單圈目標：κ 限速理想圈 ÷ 0.8 落在 35–50 秒', () => {
    const n = Math.ceil(track.len)
    const ds = track.len / n
    const lim = Array.from({ length: n }, (_, i) => Math.min(MAX_SPEED, 2.4 / Math.max(1e-6, Math.abs(curvatureAt(track, i * ds)))))
    const v = [...lim]
    for (let k = 0; k < 2; k++) {
      for (let i = 1; i < 2 * n; i++) v[i % n] = Math.min(v[i % n], Math.sqrt(v[(i - 1) % n] ** 2 + 2 * ACCEL * ds))
      for (let i = 2 * n - 2; i >= 0; i--) v[i % n] = Math.min(v[i % n], Math.sqrt(v[(i + 1) % n] ** 2 + 2 * BRAKE * ds))
    }
    const ideal = v.reduce((t, x) => t + ds / x, 0)
    expect(ideal / 0.8).toBeGreaterThanOrEqual(35)
    expect(ideal / 0.8).toBeLessThanOrEqual(50)
  })

  it('檢查點不落在跳台上', () => {
    for (const s of track.checkpoints) expect(s < JUMP_S0 || s > JUMP_S1).toBe(true)
  })

  it('發車格與道具箱都在路面內', () => {
    for (const g of RACE_COURSE.grid) expect(Math.abs(trackProgress(track, g.x, g.z).lateral)).toBeLessThan(TRACK_WIDTH / 2)
    for (const b of boxLayout(RACE_COURSE)) expect(Math.abs(trackProgress(track, b.x, b.z).lateral)).toBeLessThan(TRACK_WIDTH / 2)
  })
})

describe('ITEM_ODDS（spec §2.1）', () => {
  it('4 檔、每列和為 1、順序 banana→shell→mushroom→shield', () => {
    expect(ITEM_ODDS).toHaveLength(4)
    for (const row of ITEM_ODDS) {
      expect(Object.keys(row)).toEqual(['banana', 'shell', 'mushroom', 'shield'])
      expect(row.banana + row.shell + row.mushroom + row.shield).toBeCloseTo(1, 9)
    }
    expect(ITEM_ODDS[0]).toEqual({ banana: 0.6, shell: 0, mushroom: 0, shield: 0.4 })
    expect(ITEM_ODDS[3]).toEqual({ banana: 0.1, shell: 0.35, mushroom: 0.45, shield: 0.1 })
  })
})
