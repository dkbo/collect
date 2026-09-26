import { describe, expect, it } from 'vitest'
import { composeMatrix, mergeData, roundedBox, transformData, type MeshData } from '@/babylon/fx/geometry'

/** Babylon 列向量慣例：p' = p * M（平移在 m[12..14]） */
const apply = (m: ArrayLike<number>, o: number, p: [number, number, number]): [number, number, number] => [
  p[0] * m[o] + p[1] * m[o + 4] + p[2] * m[o + 8] + m[o + 12],
  p[0] * m[o + 1] + p[1] * m[o + 5] + p[2] * m[o + 9] + m[o + 13],
  p[0] * m[o + 2] + p[1] * m[o + 6] + p[2] * m[o + 10] + m[o + 14],
]
const close = (a: number[], b: number[]) => a.forEach((v, i) => expect(v).toBeCloseTo(b[i], 5))

describe('composeMatrix', () => {
  it('縮放→旋轉 Y→平移，與 Babylon RotationY 同向（+Z 在 yaw=π/2 轉到 +X）', () => {
    const m = new Float32Array(32)
    composeMatrix(m, 16, { x: 1, y: 2, z: 3, sx: 2, sy: 1, sz: 1, yaw: Math.PI / 2 })
    close(apply(m, 16, [0, 0, 1]), [2, 2, 3])
    close(apply(m, 16, [1, 0, 0]), [1, 2, 1])
  })
  it('pitch 繞 X 先於 yaw', () => {
    const m = new Float32Array(16)
    composeMatrix(m, 0, { x: 0, y: 0, z: 0, pitch: Math.PI / 2 })
    // Babylon RotationX(π/2)：+Y → +Z
    close(apply(m, 0, [0, 1, 0]), [0, 0, 1])
  })
  it('scale 0 可用來藏實例', () => {
    const m = new Float32Array(16)
    composeMatrix(m, 0, { x: 5, y: 0, z: 0, sx: 0, sy: 0, sz: 0 })
    close(apply(m, 0, [1, 1, 1]), [5, 0, 0])
  })
})

const tris = (d: MeshData) => {
  const out: { a: number[]; b: number[]; c: number[]; n: number[] }[] = []
  const P = (i: number) => [d.positions[i * 3], d.positions[i * 3 + 1], d.positions[i * 3 + 2]]
  const N = (i: number) => [d.normals[i * 3], d.normals[i * 3 + 1], d.normals[i * 3 + 2]]
  for (let t = 0; t < d.indices.length; t += 3) {
    const [i, j, k] = [d.indices[t], d.indices[t + 1], d.indices[t + 2]]
    const n = N(i).map((v, q) => v + N(j)[q] + N(k)[q])
    out.push({ a: P(i), b: P(j), c: P(k), n })
  }
  return out
}

describe('roundedBox', () => {
  const d = roundedBox({ width: 2, height: 1, depth: 1.5, radius: 0.2, segments: 3 })
  it('頂點全部落在外框內，且外框被撐滿', () => {
    const xs = d.positions.filter((_, i) => i % 3 === 0)
    const ys = d.positions.filter((_, i) => i % 3 === 1)
    const zs = d.positions.filter((_, i) => i % 3 === 2)
    expect(Math.max(...xs)).toBeCloseTo(1, 5)
    expect(Math.min(...ys)).toBeCloseTo(-0.5, 5)
    expect(Math.max(...zs)).toBeCloseTo(0.75, 5)
  })
  it('角落被削圓：(±w/2, ±h/2, ±d/2) 的尖角不存在', () => {
    for (let i = 0; i < d.positions.length; i += 3) {
      const atCorner =
        Math.abs(Math.abs(d.positions[i]) - 1) < 1e-6 &&
        Math.abs(Math.abs(d.positions[i + 1]) - 0.5) < 1e-6 &&
        Math.abs(Math.abs(d.positions[i + 2]) - 0.75) < 1e-6
      expect(atCorner).toBe(false)
    }
  })
  it('法線為單位長度，陣列長度一致', () => {
    expect(d.normals.length).toBe(d.positions.length)
    expect(d.uvs.length).toBe((d.positions.length / 3) * 2)
    for (let i = 0; i < d.normals.length; i += 3) {
      expect(Math.hypot(d.normals[i], d.normals[i + 1], d.normals[i + 2])).toBeCloseTo(1, 5)
    }
  })
  it('三角形繞序與 Babylon CreateBox 相同（cross(b-a,c-a) 與法線反向）', () => {
    for (const { a, b, c, n } of tris(d)) {
      const u = [b[0] - a[0], b[1] - a[1], b[2] - a[2]]
      const v = [c[0] - a[0], c[1] - a[1], c[2] - a[2]]
      const cr = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]]
      const area = Math.hypot(cr[0], cr[1], cr[2])
      if (area < 1e-9) continue
      expect(cr[0] * n[0] + cr[1] * n[1] + cr[2] * n[2]).toBeLessThan(0)
    }
  })
  it('faceUV 把各面 UV 映到指定矩形（頂面 = index 4）', () => {
    const faceUV: [number, number, number, number][] = Array.from({ length: 6 }, () => [0, 0, 0.5, 1])
    faceUV[4] = [0.5, 0, 1, 1]
    const t = roundedBox({ width: 1, height: 1, depth: 1, radius: 0.1, faceUV })
    let topUs = 0
    for (let i = 0; i < t.normals.length / 3; i++) {
      if (t.normals[i * 3 + 1] > 0.999) {
        expect(t.uvs[i * 2]).toBeGreaterThanOrEqual(0.5 - 1e-6)
        topUs++
      }
    }
    expect(topUs).toBeGreaterThan(0)
  })
})

describe('transformData / mergeData', () => {
  const tri: MeshData = { positions: [0, 0, 0, 1, 0, 0, 0, 1, 0], normals: [0, 0, 1, 0, 0, 1, 0, 0, 1], uvs: [0, 0, 1, 0, 0, 1], indices: [0, 1, 2] }
  it('transformData 平移位置、旋轉法線但不平移', () => {
    const t = transformData(tri, { x: 1, y: 0, z: 0, yaw: Math.PI / 2 })
    close(t.positions.slice(0, 3), [1, 0, 0])
    close(t.normals.slice(0, 3), [1, 0, 0])
  })
  it('非等比縮放後法線仍為單位長度', () => {
    const slanted: MeshData = { ...tri, normals: [Math.SQRT1_2, Math.SQRT1_2, 0, 0, 0, 1, 0, 0, 1] }
    const t = transformData(slanted, { x: 0, y: 0, z: 0, sx: 3, sy: 1, sz: 1 })
    expect(Math.hypot(t.normals[0], t.normals[1], t.normals[2])).toBeCloseTo(1, 5)
    expect(t.normals[1]).toBeGreaterThan(t.normals[0]) // x 拉長 → 斜面法線往 y 偏
  })
  it('mergeData 串接並位移索引，缺 colors 的部件補白', () => {
    const m = mergeData([tri, { ...tri, colors: [1, 0, 0, 1, 1, 0, 0, 1, 1, 0, 0, 1] }])
    expect(m.indices).toEqual([0, 1, 2, 3, 4, 5])
    expect(m.positions.length).toBe(18)
    expect(m.colors?.slice(0, 4)).toEqual([1, 1, 1, 1])
    expect(m.colors?.slice(12, 16)).toEqual([1, 0, 0, 1])
  })
})
