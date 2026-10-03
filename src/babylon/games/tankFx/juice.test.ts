import { describe, expect, it } from 'vitest'
import { FIRE_SQUASH, HIT_SQUASH, recoilZ, squashPose, RECOIL_DIST } from '@/babylon/games/tankFx/juice'

describe('squashPose（spec §7 開砲與受擊共用曲線）', () => {
  const amp = 0.2
  it('t=0 與 t=1 回到原狀', () => {
    expect(squashPose(0, amp).sy).toBeCloseTo(1, 6)
    expect(squashPose(1, amp).sy).toBeCloseTo(1, 6)
    expect(squashPose(1, amp).sxz).toBeCloseTo(1, 6)
  })
  it('t≈0.17 壓到最低 1−amp', () => {
    expect(squashPose(0.175, amp).sy).toBeCloseTo(1 - amp, 3)
  })
  it('t≈0.6 彈高約 1+0.3·amp', () => {
    expect(squashPose(0.6, amp).sy).toBeCloseTo(1 + 0.3 * amp, 2)
  })
  it('體積近似守恆：壓扁時橫向變寬', () => {
    const p = squashPose(0.175, amp)
    expect(p.sxz).toBeCloseTo(1 + amp * 0.5, 3)
  })
  it('超出範圍夾住', () => {
    expect(squashPose(-1, amp).sy).toBe(1)
    expect(squashPose(2, amp).sy).toBe(1)
  })
  it('開砲與受擊參數照 spec', () => {
    expect(FIRE_SQUASH).toEqual({ amp: 0.12, ms: 180 })
    expect(HIT_SQUASH).toEqual({ amp: 0.22, ms: 260 })
  })
})

describe('recoilZ（砲管後座）', () => {
  it('0.15 時退到最遠，0 與 1 在原位', () => {
    expect(recoilZ(0)).toBeCloseTo(0, 6)
    expect(recoilZ(0.15)).toBeCloseTo(-RECOIL_DIST, 6)
    expect(recoilZ(1)).toBeCloseTo(0, 6)
  })
  it('回位途中介於兩者之間且單調', () => {
    const a = recoilZ(0.4)
    const b = recoilZ(0.7)
    expect(a).toBeLessThan(0)
    expect(b).toBeGreaterThan(a)
    expect(b).toBeLessThan(0)
  })
  it('範圍外為 0', () => {
    expect(recoilZ(-0.1)).toBe(0)
    expect(recoilZ(1.5)).toBe(0)
  })
})
