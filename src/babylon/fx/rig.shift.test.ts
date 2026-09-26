import { describe, expect, it } from 'vitest'
import { swingRange } from '@/babylon/fx/rig'

describe('swingRange 的 x 平移（手臂內收）', () => {
  it('dx 只平移範圍內頂點的 x，y／z 照常旋轉', () => {
    const base = new Float32Array([0.4, -1, 0, 9, 9, 9])
    const out = new Float32Array(base)
    swingRange(base, out, 0, 1, { y: 0, z: 0 }, Math.PI / 2, -0.1)
    expect(out[0]).toBeCloseTo(0.3, 5)
    expect(out[2]).toBeCloseTo(-1, 5)
    expect(Array.from(out.slice(3))).toEqual([9, 9, 9])
  })
  it('不給 dx 時 x 不變（bomber 既有行為）', () => {
    const base = new Float32Array([0.4, -1, 0])
    const out = new Float32Array(3)
    swingRange(base, out, 0, 1, { y: 0, z: 0 }, 0.3)
    expect(out[0]).toBeCloseTo(0.4, 5)
  })
})
