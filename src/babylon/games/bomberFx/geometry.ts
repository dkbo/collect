/**
 * 程式建模用的純幾何工具（不依賴 Babylon，可在 node 單測）。
 * 輸出的 MeshData 與 Babylon VertexData 欄位同名，建 mesh 時直接灌進去；
 * 矩陣一律用 Babylon 的列向量慣例（p' = p·M，平移在 m[12..14]），繞序對齊 CreateBox。
 */

export interface MeshData {
  positions: number[]
  normals: number[]
  uvs: number[]
  indices: number[]
  /** RGBA，每頂點 4 個；沒有就代表白色 */
  colors?: number[]
}

export interface Trs {
  x: number
  y: number
  z: number
  sx?: number
  sy?: number
  sz?: number
  /** 繞 Y（Babylon rotation.y 同向），後於 pitch */
  yaw?: number
  /** 繞 X（Babylon rotation.x 同向） */
  pitch?: number
}

/** 3×3 的 S·Rx·Ry（列向量），回傳 9 個數：row0, row1, row2 */
function linear(t: Trs): number[] {
  const cx = Math.cos(t.pitch ?? 0)
  const sx = Math.sin(t.pitch ?? 0)
  const cy = Math.cos(t.yaw ?? 0)
  const sy = Math.sin(t.yaw ?? 0)
  const kx = t.sx ?? 1
  const ky = t.sy ?? 1
  const kz = t.sz ?? 1
  return [
    kx * cy, 0, -kx * sy,
    ky * sx * sy, ky * cx, ky * sx * cy,
    kz * cx * sy, -kz * sx, kz * cx * cy,
  ]
}

/** 把 TRS 寫成 4×4 矩陣到 out[offset..offset+16) */
export function composeMatrix(out: Float32Array, offset: number, t: Trs): void {
  const r = linear(t)
  out[offset] = r[0]
  out[offset + 1] = r[1]
  out[offset + 2] = r[2]
  out[offset + 3] = 0
  out[offset + 4] = r[3]
  out[offset + 5] = r[4]
  out[offset + 6] = r[5]
  out[offset + 7] = 0
  out[offset + 8] = r[6]
  out[offset + 9] = r[7]
  out[offset + 10] = r[8]
  out[offset + 11] = 0
  out[offset + 12] = t.x
  out[offset + 13] = t.y
  out[offset + 14] = t.z
  out[offset + 15] = 1
}

/** 對頂點套 TRS；法線走 S⁻¹·R 再正規化（非等比縮放也正確） */
export function transformData(d: MeshData, t: Trs): MeshData {
  const r = linear(t)
  const rr = linear({ ...t, sx: 1, sy: 1, sz: 1 })
  const inv = [1 / (t.sx || 1e-6), 1 / (t.sy || 1e-6), 1 / (t.sz || 1e-6)]
  const positions: number[] = new Array(d.positions.length)
  const normals: number[] = new Array(d.normals.length)
  for (let i = 0; i < d.positions.length; i += 3) {
    const [x, y, z] = [d.positions[i], d.positions[i + 1], d.positions[i + 2]]
    positions[i] = x * r[0] + y * r[3] + z * r[6] + t.x
    positions[i + 1] = x * r[1] + y * r[4] + z * r[7] + t.y
    positions[i + 2] = x * r[2] + y * r[5] + z * r[8] + t.z
    const nx = d.normals[i] * inv[0]
    const ny = d.normals[i + 1] * inv[1]
    const nz = d.normals[i + 2] * inv[2]
    const ox = nx * rr[0] + ny * rr[3] + nz * rr[6]
    const oy = nx * rr[1] + ny * rr[4] + nz * rr[7]
    const oz = nx * rr[2] + ny * rr[5] + nz * rr[8]
    const len = Math.hypot(ox, oy, oz) || 1
    normals[i] = ox / len
    normals[i + 1] = oy / len
    normals[i + 2] = oz / len
  }
  return { positions, normals, uvs: d.uvs.slice(), indices: d.indices.slice(), colors: d.colors?.slice() }
}

/** 逐頂點上色（fn 拿位置與法線，回 RGBA） */
export function colorize(
  d: MeshData,
  fn: (p: [number, number, number], n: [number, number, number]) => readonly [number, number, number, number]
): MeshData {
  const colors: number[] = []
  for (let i = 0; i < d.positions.length; i += 3) {
    colors.push(
      ...fn([d.positions[i], d.positions[i + 1], d.positions[i + 2]], [d.normals[i], d.normals[i + 1], d.normals[i + 2]])
    )
  }
  return { ...d, colors }
}

/** 串接多個部件成一個 mesh（索引位移；有任一部件帶色時，缺色的補白） */
export function mergeData(parts: MeshData[]): MeshData {
  const withColors = parts.some((p) => p.colors)
  const out: MeshData = { positions: [], normals: [], uvs: [], indices: [], colors: withColors ? [] : undefined }
  for (const p of parts) {
    const base = out.positions.length / 3
    const n = p.positions.length / 3
    out.positions.push(...p.positions)
    out.normals.push(...p.normals)
    out.uvs.push(...(p.uvs.length === n * 2 ? p.uvs : new Array(n * 2).fill(0)))
    for (const i of p.indices) out.indices.push(i + base)
    if (out.colors) out.colors.push(...(p.colors ?? new Array(n * 4).fill(1)))
  }
  return out
}

export type FaceUV = [number, number, number, number]

export interface RoundedBoxOpts {
  width: number
  height: number
  depth: number
  radius: number
  /** 每個圓角的分段數（預設 2） */
  segments?: number
  /** 6 面的 UV 矩形 [u0, v0, u1, v1]，面序：+Z, −Z, +X, −X, +Y, −Y */
  faceUV?: FaceUV[]
}

type V3 = [number, number, number]
/** 面序：+Z, −Z, +X, −X, +Y, −Y；U = V × (−N)，從外面看不鏡像，V 在側面朝上 */
const FACES: { n: V3; u: V3; v: V3 }[] = [
  { n: [0, 0, 1], u: [-1, 0, 0], v: [0, 1, 0] },
  { n: [0, 0, -1], u: [1, 0, 0], v: [0, 1, 0] },
  { n: [1, 0, 0], u: [0, 0, 1], v: [0, 1, 0] },
  { n: [-1, 0, 0], u: [0, 0, -1], v: [0, 1, 0] },
  { n: [0, 1, 0], u: [1, 0, 0], v: [0, 0, 1] },
  { n: [0, -1, 0], u: [1, 0, 0], v: [0, 0, -1] },
]

/** 一軸上的取樣座標：中段兩點 ±(h−r)，圓角區以 tan 等角取樣到 ±h（每面只負責 45°） */
function axisCoords(h: number, r: number, seg: number): number[] {
  const inner = h - r
  const side: number[] = []
  for (let k = 1; k <= seg; k++) side.push(inner + r * Math.tan(((k / seg) * Math.PI) / 4))
  return [...side.map((v) => -v).reverse(), -inner, inner, ...side]
}

/** 圓角盒：每面是一張網格，頂點投影到內框 + 半徑的圓角面上（法線連續，稜角平滑） */
export function roundedBox(o: RoundedBoxOpts): MeshData {
  const half: V3 = [o.width / 2, o.height / 2, o.depth / 2]
  const r = Math.max(0, Math.min(o.radius, ...half))
  const seg = Math.max(1, o.segments ?? 2)
  const out: MeshData = { positions: [], normals: [], uvs: [], indices: [] }
  const absAxis = (a: V3) => (a[0] !== 0 ? 0 : a[1] !== 0 ? 1 : 2)

  FACES.forEach((f, fi) => {
    const hn = half[absAxis(f.n)]
    const hu = half[absAxis(f.u)]
    const hv = half[absAxis(f.v)]
    const us = axisCoords(hu, r, seg)
    const vs = axisCoords(hv, r, seg)
    const [u0, v0, u1, v1] = o.faceUV?.[fi] ?? [0, 0, 1, 1]
    const base = out.positions.length / 3
    for (const b of vs) {
      for (const a of us) {
        const p: V3 = [0, 1, 2].map((k) => f.n[k] * hn + f.u[k] * a + f.v[k] * b) as V3
        const inner = p.map((c, k) => Math.max(-(half[k] - r), Math.min(half[k] - r, c))) as V3
        let d = p.map((c, k) => c - inner[k]) as V3
        const len = Math.hypot(...d)
        d = len > 1e-9 ? (d.map((c) => c / len) as V3) : f.n
        out.positions.push(...inner.map((c, k) => c + d[k] * r))
        out.normals.push(...d)
        const uu = (a + hu) / (2 * hu)
        const vv = (b + hv) / (2 * hv)
        out.uvs.push(u0 + uu * (u1 - u0), v0 + vv * (v1 - v0))
      }
    }
    const w = us.length
    for (let j = 0; j < vs.length - 1; j++) {
      for (let i = 0; i < w - 1; i++) {
        const a = base + j * w + i
        const b = a + 1
        const c = a + w + 1
        const d = a + w
        out.indices.push(a, b, c, a, c, d)
      }
    }
  })
  return out
}
