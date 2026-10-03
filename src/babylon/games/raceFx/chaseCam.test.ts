import { describe, it, expect } from 'vitest'
import {
  CHASE,
  chaseFov,
  chaseRadius,
  chaseTarget,
  initChase,
  snapGrid,
  stepChase,
  type ChaseInput,
} from '@/babylon/games/raceFx/chaseCam'
import { MAX_SPEED } from '@/babylon/games/raceRules/drive'

const car = (o: Partial<ChaseInput> = {}): ChaseInput => ({
  x: 0,
  z: 0,
  y: 0,
  ry: 0,
  speed: 0,
  boosting: false,
  mode: 'playing',
  countdownMs: 0,
  ...o,
})

describe('raceFx/chaseCam（spec §7）', () => {
  it('radius 煞停 9.5 → 全速 10.5 線性', () => {
    expect(chaseRadius(0)).toBeCloseTo(9.5)
    expect(chaseRadius(MAX_SPEED)).toBeCloseTo(10.5)
    expect(chaseRadius(MAX_SPEED / 2)).toBeCloseTo(10)
    expect(chaseRadius(MAX_SPEED * 2)).toBeCloseTo(10.5)
  })

  it('fov = 0.80 + 0.10·clamp01((speed−8)/9) + 加速 0.08', () => {
    expect(chaseFov(0, false)).toBeCloseTo(0.8)
    expect(chaseFov(8, false)).toBeCloseTo(0.8)
    expect(chaseFov(17, false)).toBeCloseTo(0.9)
    expect(chaseFov(30, true)).toBeCloseTo(0.98)
  })

  it('target = 車 + (0, 1.6 + 0.5·y, 0) + 車頭方向 × 2.5', () => {
    const t = chaseTarget(car({ x: 1, z: 2, y: 1, ry: Math.PI / 2 }))
    expect(t[0]).toBeCloseTo(1 + 2.5)
    expect(t[1]).toBeCloseTo(1.6 + 0.5)
    expect(t[2]).toBeCloseTo(2)
  })

  it('對局中 beta 1.36、alpha 往 −ry − π/2 收斂、fov 平滑趨近', () => {
    let s = initChase(car({ ry: 0 }))
    expect(s.beta).toBeCloseTo(CHASE.beta)
    expect(CHASE.beta).toBeCloseTo(1.36)
    const input = car({ ry: 0.5, speed: 17 })
    for (let i = 0; i < 120; i++) s = stepChase(s, input, 1 / 60)
    expect(s.alpha).toBeCloseTo(-0.5 - Math.PI / 2, 3)
    expect(s.fov).toBeCloseTo(0.9, 2)
    expect(s.radius).toBeCloseTo(10.5)
    // 一幀內 fov 不會跳到目標
    const s2 = stepChase(initChase(car()), car({ speed: 17 }), 1 / 60)
    expect(s2.fov).toBeLessThan(0.9)
    expect(s2.fov).toBeGreaterThan(0.8)
  })

  it('倒數最後 0.9 s 從車正前方繞到車後，GO 時正好在車後', () => {
    const ry = 0.3
    const s0 = stepChase(initChase(car({ ry })), car({ ry, mode: 'countdown', countdownMs: 2000 }), 1 / 60)
    expect(s0.alpha).toBeCloseTo(-ry + Math.PI / 2)
    const mid = stepChase(s0, car({ ry, mode: 'countdown', countdownMs: 450 }), 1 / 60)
    const front = -ry + Math.PI / 2
    expect(mid.alpha).toBeLessThan(front)
    expect(mid.alpha).toBeGreaterThan(front - Math.PI)
    const end = stepChase(mid, car({ ry, mode: 'countdown', countdownMs: 0 }), 1 / 60)
    expect(end.alpha).toBeCloseTo(-ry - Math.PI / 2)
  })

  it('衝線後拉遠到 14、beta 1.15，每秒繞 0.25 rad', () => {
    let s = initChase(car())
    for (let i = 0; i < 600; i++) s = stepChase(s, car({ mode: 'finished' }), 1 / 60)
    expect(s.radius).toBeCloseTo(14, 1)
    expect(s.beta).toBeCloseTo(1.15, 2)
    const a0 = s.alpha
    s = stepChase(s, car({ mode: 'finished' }), 1)
    expect(s.alpha - a0).toBeCloseTo(0.25)
  })

  it('snapGrid 以 4 單位量化陰影中心（避免 shimmering）', () => {
    expect(snapGrid(0, 4)).toBe(0)
    expect(snapGrid(1.9, 4)).toBe(0)
    expect(snapGrid(2.1, 4)).toBe(4)
    expect(snapGrid(-6.1, 4)).toBe(-8)
  })
})
