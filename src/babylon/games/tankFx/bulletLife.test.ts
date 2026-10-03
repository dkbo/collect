import { describe, it, expect } from 'vitest'
import { SIM_HZ, advanceBullet, type AgedBullet } from '@/babylon/games/tankFx/bulletLife'
import { GRID_H, GRID_W, cellToWorld } from '@/babylon/games/tankFx/grid'

const DT = 1000 / SIM_HZ / 1000 // 與 createFixedTicker(SIM_HZ) 的 stepMs / 1000 同算法
const SPEED = 12
const LIFE = 2000
const wx = (c: number) => cellToWorld(c, GRID_W)
const wz = (c: number) => cellToWorld(c, GRID_H)
const none = () => false
const only = (...cells: [number, number][]) => (cx: number, cy: number) =>
  cells.some(([x, y]) => x === cx && y === cy)

/** 從左側往 +x 飛：場地 x ∈ [-16, 16]，2 秒飛 24 單位不出界 */
const fresh = (): AgedBullet => ({ x: -12.5, z: wz(4), vx: SPEED, vz: 0, bounces: 0, age: 0 })

/** 跑到到期為止，回傳活著走過的 tick 數與最後狀態 */
function flyUntilTimeout(b: AgedBullet, isWall: (cx: number, cy: number) => boolean = none) {
  let cur = b
  for (let tick = 1; tick < 1000; tick++) {
    const r = advanceBullet(cur, DT, LIFE, isWall, none)
    if (r.step.kind === 'timeout') return { lived: tick - 1, last: cur }
    if (r.step.kind !== 'move' && r.step.kind !== 'bounce') throw new Error(`unexpected ${r.step.kind}`)
    cur = { ...r.step, age: r.age }
  }
  throw new Error('never timed out')
}

describe('advanceBullet — 子彈壽命以模擬時間計算', () => {
  it('壽命按 tick 累計：30Hz 飛滿 60 tick（2 秒）後第 61 tick 才到期', () => {
    const { lived, last } = flyUntilTimeout(fresh())
    expect(lived).toBe(60)
    expect(last.age).toBeCloseTo(LIFE, 6)
    expect(last.x - -12.5).toBeCloseTo(SPEED * DT * 60, 6)
  })

  it('host 與 guest 同起點、同 tick 數：每 tick 的位置、反彈與壽命完全一致', () => {
    // 撞右側牆反彈一次後繼續飛，兩端各自推進
    const wall = only([12, 4])
    let host: AgedBullet = { x: wx(9), z: wz(4) + 0.2, vx: SPEED, vz: 1.5, bounces: 0, age: 0 }
    let guest: AgedBullet = { ...host }
    let bounced = false
    let timedOutAt = 0
    for (let tick = 1; tick <= 80; tick++) {
      const h = advanceBullet(host, DT, LIFE, wall, none)
      const g = advanceBullet(guest, DT, LIFE, wall, none)
      expect(g).toEqual(h)
      if (h.step.kind === 'bounce') bounced = true
      if (h.step.kind === 'timeout') timedOutAt = tick
      if (h.step.kind !== 'move' && h.step.kind !== 'bounce') break
      if (g.step.kind !== 'move' && g.step.kind !== 'bounce') break
      host = { ...h.step, age: h.age }
      guest = { ...g.step, age: g.age }
    }
    expect(bounced).toBe(true)
    expect(timedOutAt).toBe(61)
  })

  it('補步被截斷（host 卡頓，真實時間 3 秒只跑 40 tick）：壽命不提早到期，飛行距離不被吃掉', () => {
    // fixedTick 的 MAX_ACCUM_MS 截斷補步時，host 只推進了 40 tick；壽命只看推進過的模擬時間
    let b: AgedBullet = fresh()
    for (let tick = 1; tick <= 40; tick++) {
      const r = advanceBullet(b, DT, LIFE, none, none)
      expect(r.step.kind).toBe('move')
      if (r.step.kind !== 'move') return
      b = { ...r.step, age: r.age }
    }
    expect(b.age).toBeCloseTo(40 * DT * 1000, 6)
    // 之後恢復正常：仍要再飛滿 20 tick 才到期，總飛行距離 = 完整 2 秒
    const { lived, last } = flyUntilTimeout(b)
    expect(lived).toBe(20)
    expect(last.x - -12.5).toBeCloseTo(SPEED * DT * 60, 6)
  })

  it('反彈不重置壽命', () => {
    // x=3 往右撞格 12（左緣 x=8）反彈，掉頭到外圈 x=-16 還有 24 單位，壽命先到
    const wall = only([12, 4])
    const { lived, last } = flyUntilTimeout({ x: wx(9), z: wz(4), vx: SPEED, vz: 0, bounces: 0, age: 0 }, wall)
    expect(last.bounces).toBe(1)
    expect(lived).toBe(60)
  })

  it('撞牆／木箱等非飛行結果原樣帶出，age 仍累加', () => {
    const crate = only([5, 4])
    const r = advanceBullet({ x: wx(4) + 0.8, z: wz(4), vx: SPEED, vz: 0, bounces: 0, age: 100 }, DT, LIFE, none, crate)
    expect(r.step).toEqual({ kind: 'crate', cx: 5, cy: 4 })
    expect(r.age).toBeCloseTo(100 + DT * 1000, 6)
  })
})
