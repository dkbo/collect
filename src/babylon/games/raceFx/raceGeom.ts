/**
 * 賽車路面幾何（純函式，產頂點資料給 VertexData）：閉合中心線兩側 ±halfW 的帶狀網格。
 * uv：u 左 0 右 1，v = 沿線距離 × vPerUnit（spec §4.3 路面貼圖每 8 單位一格 → 1/8）。
 * 閉合處多放一圈頂點（位置同第 0 圈、v = len·vPerUnit），最後一段 v 才會往前走、不會倒著拉伸整張貼圖。
 */
import type { Track } from '@/babylon/games/raceRules/track'

export interface StripData {
  positions: number[]
  indices: number[]
  normals: number[]
  uvs: number[]
}

export function roadStrip(track: Track, halfW: number, y: number, vPerUnit = 1): StripData {
  const n = track.pts.length
  const positions: number[] = []
  const normals: number[] = []
  const uvs: number[] = []
  const indices: number[] = []
  for (let i = 0; i <= n; i++) {
    const k = i % n
    const prev = track.pts[(k - 1 + n) % n]
    const next = track.pts[(k + 1) % n]
    // 切線取前後點平均方向，右側 = (dz, −dx)（同 track.ts 的 lateral 右正）
    const dx = next[0] - prev[0]
    const dz = next[1] - prev[1]
    const l = Math.hypot(dx, dz) || 1
    const rx = dz / l
    const rz = -dx / l
    const [cx, cz] = track.pts[k]
    const v = (i === n ? track.len : track.cum[k]) * vPerUnit
    positions.push(cx - rx * halfW, y, cz - rz * halfW, cx + rx * halfW, y, cz + rz * halfW)
    normals.push(0, 1, 0, 0, 1, 0)
    uvs.push(0, v, 1, v)
    if (i < n) {
      const a = i * 2
      const b = a + 2
      indices.push(a, a + 1, b, b, a + 1, b + 1)
    }
  }
  return { positions, indices, normals, uvs }
}
