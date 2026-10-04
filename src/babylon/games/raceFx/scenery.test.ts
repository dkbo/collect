import { describe, it, expect } from 'vitest'
import { RACE_COURSE } from '@/babylon/games/raceRules/trackData'
import { curvatureAt, trackProgress } from '@/babylon/games/raceRules/track'
import {
  CURB_K,
  CURB_LATERAL,
  DECOR_CLEAR,
  blockSpots,
  boxPose,
  coneSpots,
  crowdSpots,
  curbSpots,
  standPose,
  treeSpots,
} from '@/babylon/games/raceFx/scenery'

const T = RACE_COURSE.track
const lat = (x: number, z: number) => Math.abs(trackProgress(T, x, z).lateral)

describe('raceFx/scenery — 路緣（spec §4.3）', () => {
  const curbs = curbSpots(T)

  it('只放在 |κ| ≥ 1/40 的路段、左右兩側 lateral ±6.45', () => {
    expect(CURB_K).toBeCloseTo(1 / 40)
    expect(CURB_LATERAL).toBeCloseTo(6.45)
    for (const c of curbs) {
      expect(Math.abs(curvatureAt(T, c.s))).toBeGreaterThanOrEqual(CURB_K - 1e-9)
      expect(lat(c.x, c.z)).toBeCloseTo(CURB_LATERAL, 0)
    }
  })

  it('起跑直線（s 0–60）沒有路緣；總數約 300、紅白交替', () => {
    expect(curbs.some((c) => c.s > 1 && c.s < 60)).toBe(false)
    expect(curbs.length).toBeGreaterThan(200)
    expect(curbs.length).toBeLessThan(420)
    const left = curbs.filter((c) => c.side < 0)
    for (let i = 1; i < left.length; i++) {
      if (Math.abs(left[i].s - left[i - 1].s - 1.6) < 1e-6) expect(left[i].red).not.toBe(left[i - 1].red)
    }
  })
})

describe('raceFx/scenery — 裝飾離路緣 ≥ 9（不穿模）', () => {
  it(`積木約 40 筆、樹約 24 棵，中心離中心線 ≥ ${DECOR_CLEAR}`, () => {
    const blocks = blockSpots(T)
    const trees = treeSpots(T)
    expect(blocks.length).toBeGreaterThanOrEqual(30)
    expect(blocks.length).toBeLessThanOrEqual(50)
    expect(trees.length).toBeGreaterThanOrEqual(20)
    expect(trees.length).toBeLessThanOrEqual(28)
    for (const b of blocks) expect(lat(b.x, b.z)).toBeGreaterThanOrEqual(DECOR_CLEAR)
    for (const t of trees) expect(lat(t.x, t.z)).toBeGreaterThanOrEqual(DECOR_CLEAR)
    // 疊層：y 是 1.2 的整數倍
    for (const b of blocks) expect((b.y / 1.2) % 1).toBeCloseTo(0, 5)
  })

  it('三角錐 12 個：T2 外側 8 個（右側 +8.5）、T3 外側 4 個（左側 −8.5）', () => {
    const cones = coneSpots(T)
    expect(cones).toHaveLength(12)
    for (const c of cones) expect(lat(c.x, c.z)).toBeCloseTo(8.5, 0)
  })
})

describe('raceFx/scenery — 看台與觀眾', () => {
  it('看台在起跑直線北側（左側 lateral −15～−21），觀眾約 100 個都在看台範圍', () => {
    const st = standPose(T)
    const p = trackProgress(T, st.x, st.z)
    expect(p.lateral).toBeLessThan(-15)
    expect(p.lateral).toBeGreaterThan(-21)
    const crowd = crowdSpots(T)
    expect(crowd.length).toBeGreaterThanOrEqual(80)
    expect(crowd.length).toBeLessThanOrEqual(130)
    for (const c of crowd) {
      const q = trackProgress(T, c.x, c.z)
      expect(q.lateral).toBeLessThanOrEqual(-14)
      expect(q.lateral).toBeGreaterThanOrEqual(-22)
      expect(c.y).toBeGreaterThan(0)
    }
  })
})

describe('raceFx/scenery — 道具箱浮動（spec §4.2）', () => {
  it('y 在 1.1 ± 0.15、週期 1.6s，相位依 id 錯開 0.4s；斜放 0.35', () => {
    const a = boxPose(0, 0)
    const b = boxPose(0, 1.6)
    expect(a.y).toBeCloseTo(b.y, 6)
    for (let t = 0; t < 2; t += 0.1) {
      const p = boxPose(3, t)
      expect(p.y).toBeGreaterThanOrEqual(1.1 - 0.15 - 1e-9)
      expect(p.y).toBeLessThanOrEqual(1.1 + 0.15 + 1e-9)
      expect(p.pitch).toBeCloseTo(0.35)
    }
    expect(boxPose(1, 0).y).toBeCloseTo(boxPose(0, 0.4).y, 6)
    // 每秒轉 1.4 rad
    expect(boxPose(0, 1).yaw - boxPose(0, 0).yaw).toBeCloseTo(1.4)
  })
})
