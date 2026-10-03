/**
 * 賽車路面幾何（純函式，產頂點資料給 VertexData）：閉合中心線兩側 ±halfW 的帶狀網格。
 * 波 2 暫用的簡單路面；uv 的 v 沿線累積距離（每單位 1），u 左 0 右 1。
 */
import type { Track } from '@/babylon/games/raceRules/track'

export interface StripData {
  positions: number[]
  indices: number[]
  normals: number[]
  uvs: number[]
}

export function roadStrip(track: Track, halfW: number, y: number): StripData {
  const n = track.pts.length
  const positions: number[] = []
  const normals: number[] = []
  const uvs: number[] = []
  const indices: number[] = []
  for (let i = 0; i < n; i++) {
    const prev = track.pts[(i - 1 + n) % n]
    const next = track.pts[(i + 1) % n]
    // 切線取前後點平均方向，右側 = (dz, −dx)（同 track.ts 的 lateral 右正）
    const dx = next[0] - prev[0]
    const dz = next[1] - prev[1]
    const l = Math.hypot(dx, dz) || 1
    const rx = dz / l
    const rz = -dx / l
    const [cx, cz] = track.pts[i]
    positions.push(cx - rx * halfW, y, cz - rz * halfW, cx + rx * halfW, y, cz + rz * halfW)
    normals.push(0, 1, 0, 0, 1, 0)
    uvs.push(0, track.cum[i], 1, track.cum[i])
    const a = i * 2
    const b = ((i + 1) % n) * 2
    indices.push(a, a + 1, b, b, a + 1, b + 1)
  }
  return { positions, indices, normals, uvs }
}
