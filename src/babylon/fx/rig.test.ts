import { describe, expect, it } from 'vitest'
import { swingRange } from '@/babylon/fx/rig'

describe('swingRange', () => {
  it('繞 X 軸以樞紐 (y,z) 旋轉指定範圍的頂點，範圍外不動', () => {
    // 兩個頂點：第 0 個在樞紐正下方 1 單位，第 1 個不在範圍
    const base = new Float32Array([0, -1, 0, 9, 9, 9])
    const out = new Float32Array(base)
    swingRange(base, out, 0, 1, { y: 0, z: 0 }, Math.PI / 2)
    // Babylon RotationX(θ)：y' = y·c − z·s、z' = y·s + z·c
    expect(out[1]).toBeCloseTo(0, 5)
    expect(out[2]).toBeCloseTo(-1, 5)
    expect(Array.from(out.slice(3))).toEqual([9, 9, 9])
  })
  it('pivot 為 null 時只旋轉（法線用），不帶平移', () => {
    const base = new Float32Array([0, 0, 1])
    const out = new Float32Array(3)
    swingRange(base, out, 0, 1, null, Math.PI / 2)
    expect(out[1]).toBeCloseTo(-1, 5)
    expect(out[2]).toBeCloseTo(0, 5)
  })
  it('樞紐位移不影響距離', () => {
    const base = new Float32Array([0, 0.25, 0])
    const out = new Float32Array(3)
    swingRange(base, out, 0, 1, { y: 0.5, z: 0 }, 0.7)
    expect(Math.hypot(out[1] - 0.5, out[2])).toBeCloseTo(0.25, 5)
  })
})
