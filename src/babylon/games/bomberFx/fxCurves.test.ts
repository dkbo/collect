import { describe, expect, it } from 'vitest'
import {
  armDelayMs,
  deathPose,
  emitCount,
  flameEmissive,
  floatTextPose,
  itemHop,
  pickupFlight,
  placeScale,
  ringPose,
  scorchScale,
} from '@/babylon/games/bomberFx/fxCurves'

describe('placeScale（放炸彈 back-out 0.6 → 1.0）', () => {
  it('起點 0.6、終點 1.0，超過 1 之後維持 1', () => {
    expect(placeScale(0)).toBeCloseTo(0.6)
    expect(placeScale(1)).toBeCloseTo(1)
    expect(placeScale(3)).toBe(1)
  })

  it('中段會衝過 1（back-out 的回彈）', () => {
    const peak = Math.max(...[0.5, 0.6, 0.7, 0.8, 0.9].map(placeScale))
    expect(peak).toBeGreaterThan(1)
  })
})

describe('armDelayMs（臂從中心往外依序生長）', () => {
  it('每離爆心一格延遲 25ms', () => {
    expect(armDelayMs(6, 4, 6, 4)).toBe(0)
    expect(armDelayMs(7, 4, 6, 4)).toBe(25)
    expect(armDelayMs(6, 1, 6, 4)).toBe(75)
  })
})

describe('flameEmissive', () => {
  it('從 1.0 線性降到 0.4', () => {
    expect(flameEmissive(0, 550)).toBeCloseTo(1)
    expect(flameEmissive(275, 550)).toBeCloseTo(0.7)
    expect(flameEmissive(550, 550)).toBeCloseTo(0.4)
    expect(flameEmissive(900, 550)).toBeCloseTo(0.4)
  })
})

describe('deathPose（跳起、旋轉、縮小）', () => {
  it('起點原樣、終點縮到 0', () => {
    expect(deathPose(0)).toEqual({ lift: 0, spin: 0, scale: 1 })
    expect(deathPose(1).scale).toBeCloseTo(0)
  })

  it('途中離地並持續旋轉', () => {
    const mid = deathPose(0.4)
    expect(mid.lift).toBeGreaterThan(0.5)
    expect(mid.spin).toBeGreaterThan(0)
    expect(deathPose(0.8).spin).toBeGreaterThan(mid.spin)
  })
})

describe('itemHop（道具出現往上彈 0.4 CELL 再落回）', () => {
  it('頂點約 0.4 CELL，結束時落回', () => {
    expect(itemHop(0.5, 2).lift).toBeCloseTo(0.8)
    expect(itemHop(0, 2).lift).toBeCloseTo(0)
    expect(itemHop(1, 2).lift).toBeCloseTo(0)
    expect(itemHop(2, 2)).toEqual({ lift: 0, spin: 0 })
  })

  it('期間轉一整圈', () => {
    expect(itemHop(1, 2).spin).toBeCloseTo(Math.PI * 2)
  })
})

describe('pickupFlight（縮到 0 並飛向頭頂）', () => {
  it('位置插值 0 → 1、縮放 1 → 0', () => {
    expect(pickupFlight(0)).toEqual({ k: 0, scale: 1 })
    const end = pickupFlight(1)
    expect(end.k).toBeCloseTo(1)
    expect(end.scale).toBeCloseTo(0)
  })
})

describe('ringPose / floatTextPose / scorchScale', () => {
  it('ring 擴散同時淡出', () => {
    const a = ringPose(0)
    const b = ringPose(1)
    expect(b.scale).toBeGreaterThan(a.scale)
    expect(a.alpha).toBeGreaterThan(0.5)
    expect(b.alpha).toBeCloseTo(0)
  })

  it('+1 往上飄並淡出', () => {
    expect(floatTextPose(0).rise).toBe(0)
    expect(floatTextPose(1).rise).toBeGreaterThan(0.5)
    expect(floatTextPose(1).alpha).toBeCloseTo(0)
    expect(floatTextPose(0.2).alpha).toBeCloseTo(1)
  })

  it('焦痕 1.5 秒：前段維持原大小，最後 400ms 縮到 0', () => {
    expect(scorchScale(0, 1500)).toBe(1)
    expect(scorchScale(1100, 1500)).toBe(1)
    expect(scorchScale(1300, 1500)).toBeCloseTo(0.5)
    expect(scorchScale(1500, 1500)).toBe(0)
  })
})

describe('emitCount（每秒發射率 → 本幀顆數，小數累積到下一幀）', () => {
  it('30/s 在 60fps 下每兩幀一顆', () => {
    let acc = 0
    let total = 0
    for (let i = 0; i < 60; i++) {
      const r = emitCount(acc, 30, 1000 / 60)
      acc = r.acc
      total += r.count
    }
    expect(total).toBe(30)
  })

  it('暫停後的大 dt 不會一次噴爆', () => {
    expect(emitCount(0, 30, 5000).count).toBeLessThanOrEqual(3)
  })
})
