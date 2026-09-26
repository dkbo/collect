/**
 * 玩具系列程式建模的通用積木：圓角盒以外的球、圓柱、頂點色（單色／徑向漸層）、擺放與轉成 Babylon Mesh。
 * 遊戲專屬的物件組合留在各自的 `games/<遊戲>Fx/models.ts`。
 */
import { Mesh, VertexBuilders, VertexData, type Scene } from '@/babylon/babylonCore'
import { colorize, transformData, type MeshData, type Trs } from '@/babylon/fx/geometry'
import { hexToRgb } from '@/babylon/fx/palette'

export type Rgba = readonly [number, number, number, number]
export const rgba = (hex: string, a = 1): Rgba => [...hexToRgb(hex), a] as const
const lerp = (a: Rgba, b: Rgba, t: number): Rgba => [
  a[0] + (b[0] - a[0]) * t,
  a[1] + (b[1] - a[1]) * t,
  a[2] + (b[2] - a[2]) * t,
  1,
]

/** Babylon VertexData → MeshData */
const fromVD = (vd: VertexData): MeshData => ({
  positions: Array.from(vd.positions ?? []),
  normals: Array.from(vd.normals ?? []),
  uvs: Array.from(vd.uvs ?? []),
  indices: Array.from(vd.indices ?? []),
})

export const sphere = (diameter: number, segments = 12): MeshData =>
  fromVD(VertexBuilders.CreateSphereVertexData({ diameter, segments }))

export const cylinder = (height: number, diameter: number, tessellation = 10): MeshData =>
  fromVD(VertexBuilders.CreateCylinderVertexData({ height, diameter, tessellation }))

export const solid = (d: MeshData, c: Rgba): MeshData => colorize(d, () => c)

/** 三段徑向漸層（亮 → 本色 → 暗），以法線與高光方向的夾角決定；對應 spec 的 radial gradient */
export const radial = (d: MeshData, light: string, base: string, dark: string, dir: [number, number, number] = [-0.35, 0.85, -0.4]): MeshData => {
  const len = Math.hypot(...dir)
  const [hx, hy, hz] = dir.map((v) => v / len)
  const L = rgba(light)
  const B = rgba(base)
  const D = rgba(dark)
  return colorize(d, (_p, n) => {
    const t = (1 - (n[0] * hx + n[1] * hy + n[2] * hz)) / 2 // 0 = 正對高光
    return t < 0.5 ? lerp(L, B, t / 0.5) : lerp(B, D, (t - 0.5) / 0.5)
  })
}

export const at = (d: MeshData, t: Trs): MeshData => transformData(d, t)

/** MeshData → Babylon Mesh（updatable 供 CPU 擺動四肢） */
export function toMesh(name: string, d: MeshData, scene: Scene, updatable = false): Mesh {
  const vd = new VertexData()
  vd.positions = d.positions
  vd.normals = d.normals
  vd.uvs = d.uvs
  vd.indices = d.indices
  if (d.colors) vd.colors = d.colors
  const mesh = new Mesh(name, scene)
  vd.applyToMesh(mesh, updatable)
  return mesh
}
