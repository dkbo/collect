import { afterEach, describe, expect, it, vi } from 'vitest'
import { easeOutCubic, prefersReducedMotion, valueAt } from './useCountUp'

describe('easeOutCubic', () => {
  it('端點為 0 與 1，且會 clamp', () => {
    expect(easeOutCubic(0)).toBe(0)
    expect(easeOutCubic(1)).toBe(1)
    expect(easeOutCubic(-1)).toBe(0)
    expect(easeOutCubic(2)).toBe(1)
  })

  it('單調遞增', () => {
    let prev = 0
    for (let t = 0.1; t <= 1; t += 0.1) {
      const v = easeOutCubic(t)
      expect(v).toBeGreaterThanOrEqual(prev)
      prev = v
    }
  })
})

describe('valueAt', () => {
  it('起點 0、終點 target、途中為整數', () => {
    expect(valueAt(13, 0, 1200)).toBe(0)
    expect(valueAt(13, 1200, 1200)).toBe(13)
    expect(valueAt(13, 5000, 1200)).toBe(13)
    expect(Number.isInteger(valueAt(13, 600, 1200))).toBe(true)
  })
})

describe('prefersReducedMotion', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('matchMedia 回 matches:true 時為 true', () => {
    vi.stubGlobal('matchMedia', vi.fn().mockReturnValue({ matches: true }))
    expect(prefersReducedMotion()).toBe(true)
  })

  it('沒有 matchMedia 時為 false', () => {
    vi.stubGlobal('matchMedia', undefined)
    expect(prefersReducedMotion()).toBe(false)
  })
})
