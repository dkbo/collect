/**
 * A「Toy Racer」場景擺放（spec §4.3，純函式）：路緣、積木、樹、錐、看台與觀眾、旗子、拱門、跳台、道具箱浮動。
 * 全部由賽道幾何決定（各端一致、不吃亂數）；裝飾一律擺在路緣外 ≥ 9 單位，正常開不會穿模。
 */
import { curvatureAt, placeAt, pointAt, trackProgress, type Track } from '@/babylon/games/raceRules/track'
import { flagPoles } from '@/babylon/games/raceFx/models'

/** 路緣只放在 |κ| ≥ 1/40 的路段 */
export const CURB_K = 1 / 40
/** 路緣中心離中心線（路半寬 6 + 半塊 0.45） */
export const CURB_LATERAL = 6.45
/** 路緣沿線間距 */
export const CURB_STEP = 1.6
/** 裝飾中心離中心線的最小距離（路緣外緣 6.9 + 9）；積木群中心再多留 3（群內位移與積木半長） */
export const DECOR_CLEAR = 16
/** 看台：起跑直線北側 s 4–44，前緣 lateral −15.3、深 6 */
export const STAND = { s: 24, front: -15.3, len: 40 } as const
const BLOCK_H = 1.2
const GROUND = { x: 97, z: 89 }

export interface Spot {
  x: number
  z: number
  yaw: number
}

export interface CurbSpot extends Spot {
  s: number
  side: -1 | 1
  red: boolean
}

export function curbSpots(t: Track): CurbSpot[] {
  const out: CurbSpot[] = []
  for (const side of [-1, 1] as const) {
    for (let k = 0; k * CURB_STEP < t.len; k++) {
      const s = k * CURB_STEP
      if (Math.abs(curvatureAt(t, s)) < CURB_K) continue
      const p = placeAt(t, s, side * CURB_LATERAL)
      out.push({ s, side, red: k % 2 === 0, x: p.x, z: p.z, yaw: p.heading })
    }
  }
  return out
}

/** 離中心線不到 min 就沿「最近中心線點 → 該點」方向往外推（最多 6 次），再夾在桌墊內 */
export function pushClear(t: Track, x: number, z: number, min: number): { x: number; z: number } {
  let px = x
  let pz = z
  for (let i = 0; i < 6; i++) {
    const p = trackProgress(t, px, pz)
    const d = Math.abs(p.lateral)
    if (d >= min) break
    const c = pointAt(t, p.s)
    let dx = px - c.x
    let dz = pz - c.z
    const l = Math.hypot(dx, dz)
    if (l < 1e-6) {
      dx = Math.cos(c.heading)
      dz = -Math.sin(c.heading)
    } else {
      dx /= l
      dz /= l
    }
    const step = min - d + 0.5
    px += dx * step
    pz += dz * step
  }
  return { x: Math.max(-GROUND.x, Math.min(GROUND.x, px)), z: Math.max(-GROUND.z, Math.min(GROUND.z, pz)) }
}

export interface BlockSpot extends Spot {
  y: number
  kind: '2x2' | '2x4'
  color: 0 | 1 | 2 | 3
}

/** 積木群：中心、層數（第 L 層 layers − L 塊，往上收成小塔）；前 4 群是 spec 指定的位置 */
const BLOCK_GROUPS: { x: number; z: number; layers: number }[] = [
  { x: -30, z: -40, layers: 3 },
  { x: 40, z: 20, layers: 2 },
  { x: 52, z: 80, layers: 2 },
  { x: -86, z: -84, layers: 2 },
  { x: 94, z: -62, layers: 2 },
  { x: 94, z: 20, layers: 2 },
  { x: 94, z: 62, layers: 1 },
  { x: -94, z: 50, layers: 2 },
  { x: -94, z: 12, layers: 1 },
  { x: -50, z: 84, layers: 2 },
  { x: -10, z: 84, layers: 1 },
  { x: 86, z: -86, layers: 2 },
  { x: 96, z: -24, layers: 1 },
  { x: -40, z: 30, layers: 2 },
  { x: -60, z: -40, layers: 1 },
]

export function blockSpots(t: Track): BlockSpot[] {
  const out: BlockSpot[] = []
  BLOCK_GROUPS.forEach((g, gi) => {
    const c = pushClear(t, g.x, g.z, DECOR_CLEAR + 3)
    const yaw = (gi % 4) * (Math.PI / 4)
    const ax = Math.cos(yaw)
    const az = -Math.sin(yaw)
    for (let L = 0; L < g.layers; L++) {
      const n = g.layers - L
      for (let i = 0; i < n; i++) {
        const off = (i - (n - 1) / 2) * 2.1
        const kind = (gi + L + i) % 3 === 0 ? '2x4' : '2x2'
        out.push({
          x: c.x + ax * off,
          z: c.z + az * off,
          y: L * BLOCK_H,
          yaw: yaw + (L % 2) * (Math.PI / 2),
          kind,
          color: ((gi + L * 2 + i) % 4) as 0 | 1 | 2 | 3,
        })
      }
    }
  })
  return out
}

/** spec 稿上 12 棵＋場外與內野補 12 棵 */
const TREES: [number, number][] = [
  [-50, -40], [-20, -30], [2, -42], [36, -26], [32, 34], [-58, 18], [-40, 22], [62, 60], [-88, 30], [88, -10], [10, 80], [-60, -84],
  [-95, -60], [95, 40], [-30, 86], [60, -88], [-95, 80], [95, -40], [0, 30], [-55, 60], [80, 86], [-15, -88], [40, -45], [-70, 40],
]

export function treeSpots(t: Track): Spot[] {
  return TREES.map(([x, z], i) => ({ ...pushClear(t, x, z, DECOR_CLEAR), yaw: i * 0.7 }))
}

/** 三角錐：T2 髮夾外側（右 +8.5）s 228–252 每 3.4、T3 外側（左 −8.5）s 322–334 每 4 */
export function coneSpots(t: Track): Spot[] {
  const out: Spot[] = []
  for (let i = 0; i < 8; i++) {
    const p = placeAt(t, 228 + i * 3.4, 8.5)
    out.push({ x: p.x, z: p.z, yaw: p.heading })
  }
  for (let i = 0; i < 4; i++) {
    const p = placeAt(t, 322 + i * 4, -8.5)
    out.push({ x: p.x, z: p.z, yaw: p.heading })
  }
  return out
}

/** 看台座標系：原點在前緣中心，x 沿行進方向、+z 遠離賽道（左側）；yaw 對應 fx/geometry 的 Trs */
export function standPose(t: Track): Spot & { len: number } {
  const p = placeAt(t, STAND.s, STAND.front)
  return { x: p.x, z: p.z, yaw: p.heading - Math.PI / 2, len: STAND.len }
}

/** 看台座標 → 世界（Trs 的 yaw：local x → (cos, −sin)，local z → (sin, cos)） */
function standToWorld(pose: Spot, lx: number, lz: number): { x: number; z: number } {
  const c = Math.cos(pose.yaw)
  const s = Math.sin(pose.yaw)
  return { x: pose.x + lx * c + lz * s, z: pose.z - lx * s + lz * c }
}

export interface CrowdSpot extends Spot {
  y: number
  color: number
}

/** 觀眾：3 階 × 每 1.1 一個，站在各階頂面中線 */
export function crowdSpots(t: Track): CrowdSpot[] {
  const pose = standPose(t)
  const out: CrowdSpot[] = []
  const per = Math.floor(pose.len / 1.1)
  for (let tier = 0; tier < 3; tier++) {
    for (let i = 0; i < per; i++) {
      const lx = -pose.len / 2 + 0.55 + i * 1.1
      const w = standToWorld(pose, lx, 1 + tier * 2)
      out.push({ ...w, y: BLOCK_H * (tier + 1), yaw: pose.yaw, color: (i * 3 + tier) % 5 })
    }
  }
  return out
}

/** 看台屋頂旗子：旗桿頂端世界座標（旗面左緣掛在這） */
export function flagSpots(t: Track): (Spot & { y: number })[] {
  const pose = standPose(t)
  return flagPoles(pose.len).map((p) => ({ ...standToWorld(pose, p.x, p.z), y: p.y - 0.4, yaw: pose.yaw }))
}

/** 起跑拱門：s = 0 中心、x 橫跨賽道 */
export function archPose(t: Track): Spot {
  const p = pointAt(t, 0)
  return { x: p.x, z: p.z, yaw: p.heading }
}

/** 跳台：從 s0 的中心線點朝 s1 擺，長度 = 兩點距離 */
export function rampPose(t: Track, s0: number, s1: number): Spot & { len: number } {
  const a = pointAt(t, s0)
  const b = pointAt(t, s1)
  return { x: a.x, z: a.z, yaw: Math.atan2(b.x - a.x, b.z - a.z), len: Math.hypot(b.x - a.x, b.z - a.z) }
}

/** 道具箱浮動：y 1.1 ± 0.15（週期 1.6s，相位依 id 錯開 0.4s）、每秒轉 1.4 rad、斜放 0.35 */
export function boxPose(id: number, tSec: number): { y: number; yaw: number; pitch: number } {
  const ph = tSec + id * 0.4
  return { y: 1.1 + 0.15 * Math.sin((ph / 1.6) * Math.PI * 2), yaw: ph * 1.4, pitch: 0.35 }
}
