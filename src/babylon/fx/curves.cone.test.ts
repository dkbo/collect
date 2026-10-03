import { describe, expect, it } from 'vitest'
import { coneDirection } from '@/babylon/fx/curves'

const angle = (a: readonly number[], b: readonly number[]): number => {
  const dot = a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
  return Math.acos(Math.min(1, Math.max(-1, dot / (Math.hypot(...a) * Math.hypot(...b)))))
}

describe('coneDirection（沿某方向 ±半角噴出）', () => {
  const cone = (25 * Math.PI) / 180

  it('r1 = 0 時正對 aim', () => {
    const d = coneDirection([3, 0, 4], cone, 0, 0.3)
    expect(d[0]).toBeCloseTo(0.6, 6)
    expect(d[2]).toBeCloseTo(0.8, 6)
  })

  it('一律是單位向量且落在半角內', () => {
    for (const aim of [
      [1, 0, 0],
      [0, 1, 0],
      [0, -1, 0],
      [-0.3, 0.2, 0.9],
    ] as const) {
      for (const [r1, r2] of [
        [0.99, 0],
        [0.5, 0.25],
        [0.999, 0.75],
      ]) {
        const d = coneDirection(aim, cone, r1, r2)
        expect(Math.hypot(...d)).toBeCloseTo(1, 6)
        expect(angle(d, aim)).toBeLessThanOrEqual(cone + 1e-6)
      }
    }
  })

  it('aim 長度為 0 時往上', () => {
    expect(coneDirection([0, 0, 0], cone, 0, 0)).toEqual([0, 1, 0])
  })
})
