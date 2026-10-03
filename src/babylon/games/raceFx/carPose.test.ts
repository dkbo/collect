import { describe, it, expect } from 'vitest'
import { JUMP_S0, JUMP_S1, RACE_COURSE } from '@/babylon/games/raceRules/trackData'
import { JUMP_H, MAX_SPEED, jumpY, launchVy } from '@/babylon/games/raceRules/drive'
import { HOP_MS, YAW_RELAX_MS, bodyPose, remoteY, steerFromYaw, yawToward } from '@/babylon/games/raceFx/carPose'

const C = RACE_COURSE

describe('raceFx/carPose — 他車／bot 跳台 y 由 s 本機推算（波 2 Minor）', () => {
  it('不在跳台附近 → 0', () => {
    expect(remoteY(C, 10, 0, 17)).toBe(0)
    expect(remoteY(C, 300, 2, 17)).toBe(0)
  })

  it('坡上（|lateral| ≤ 4）→ 斜坡高度；坡外側走旁邊 → 0', () => {
    const mid = (JUMP_S0 + JUMP_S1) / 2
    expect(remoteY(C, mid, 0, 10)).toBeCloseTo(JUMP_H / 2, 2)
    expect(remoteY(C, mid, 5, 10)).toBe(0)
  })

  it('越過唇口且夠快 → 騰空弧線同 drive.jumpY（t = 飛行距離 / 速度）', () => {
    const v = MAX_SPEED
    const d = 4
    expect(remoteY(C, JUMP_S1 + d, 0, v)).toBeCloseTo(jumpY(d / v, launchVy(v)), 3)
    expect(remoteY(C, JUMP_S1 + d, 0, v)).toBeGreaterThan(JUMP_H)
    // 落地後 → 0
    expect(remoteY(C, JUMP_S1 + 30, 0, v)).toBe(0)
  })

  it('太慢（< 6）不騰空', () => {
    expect(remoteY(C, JUMP_S1 + 1, 0, 4)).toBe(0)
  })
})

describe('raceFx/carPose — 車身姿態（spec §4.1）', () => {
  it('由偏航角速度估轉向 −1..1', () => {
    expect(steerFromYaw(0, 1 / 30, 17)).toBe(0)
    expect(steerFromYaw(2.4 / 30, 1 / 30, 17)).toBeCloseTo(1)
    expect(steerFromYaw(-10, 1 / 30, 17)).toBe(-1)
    expect(steerFromYaw(1, 1 / 30, 0)).toBe(0)
  })

  it('側傾 rz = −steer·0.07·speedRatio；甩尾偏航 0.38·steer；加速車頭抬 −0.06', () => {
    const p = bodyPose({ steer: 1, speedRatio: 1, drifting: true, boosting: true, vy: 0, airborne: false, hopMs: -1, rampPitch: 0 })
    expect(p.rz).toBeCloseTo(-0.07)
    expect(p.yaw).toBeCloseTo(0.38)
    expect(p.rx).toBeCloseTo(-0.06)
    expect(p.dy).toBe(0)
  })

  it('騰空依 vy 俯仰 ±12°；甩尾起跳 0.25 高 160ms', () => {
    const up = bodyPose({ steer: 0, speedRatio: 1, drifting: false, boosting: false, vy: 20, airborne: true, hopMs: -1, rampPitch: 0 })
    expect(up.rx).toBeCloseTo((-12 * Math.PI) / 180)
    const down = bodyPose({ steer: 0, speedRatio: 1, drifting: false, boosting: false, vy: -20, airborne: true, hopMs: -1, rampPitch: 0 })
    expect(down.rx).toBeCloseTo((12 * Math.PI) / 180)
    expect(HOP_MS).toBe(160)
    const hop = bodyPose({ steer: 0, speedRatio: 0, drifting: true, boosting: false, vy: 0, airborne: false, hopMs: 80, rampPitch: 0 })
    expect(hop.dy).toBeCloseTo(0.25)
    const done = bodyPose({ steer: 0, speedRatio: 0, drifting: true, boosting: false, vy: 0, airborne: false, hopMs: 200, rampPitch: 0 })
    expect(done.dy).toBe(0)
  })
})

describe('raceFx/carPose — 甩尾放開 120ms 回正（波 3 Minor M5）', () => {
  it('目標偏航變小時以 120ms 走完全幅；變大（進甩尾）立即到位', () => {
    expect(YAW_RELAX_MS).toBe(120)
    expect(yawToward(0, 0.38, 16)).toBe(0.38)
    expect(yawToward(0.38, 0, 60)).toBeCloseTo(0.19)
    expect(yawToward(0.38, 0, 120)).toBe(0)
    expect(yawToward(-0.38, 0, 60)).toBeCloseTo(-0.19)
    expect(yawToward(0.1, 0, 200)).toBe(0)
  })
})
