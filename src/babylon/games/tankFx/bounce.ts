/**
 * 子彈逐 tick 推進與反彈（純函式）。host 判定與 guest 預測共用同一支，
 * 同輸入必得同一反彈點：反射以撞擊面鏡射位置，不依賴 tick 相位以外的狀態。
 */
import { CELL, GRID_H, GRID_W, cellToWorld, inGrid, worldToCell, type CellPred } from '@/babylon/games/tankFx/grid'

/** 子彈最多反彈次數；超過即在下一次撞牆時消失 */
export const BULLET_MAX_BOUNCE = 1

export interface BulletKin {
  x: number
  z: number
  vx: number
  vz: number
  bounces: number
}

export type BulletStep =
  | ({ kind: 'move' } & BulletKin)
  | ({ kind: 'bounce'; hitX: number; hitZ: number } & BulletKin)
  | { kind: 'expire'; hitX: number; hitZ: number }
  | { kind: 'crate'; cx: number; cy: number }

/**
 * 推進一個 tick。isWall 為不可破牆（含突然死亡落下的牆），場外一律視為牆；
 * isCrate 為木箱（打掉、子彈消失、不反彈）。
 */
export function stepBullet(b: BulletKin, dt: number, isWall: CellPred, isCrate: CellPred): BulletStep {
  const solid = (cx: number, cy: number) => !inGrid(cx, cy) || isWall(cx, cy)
  const ocx = worldToCell(b.x, GRID_W)
  const ocy = worldToCell(b.z, GRID_H)
  const dx = b.vx * dt
  const dz = b.vz * dt
  const nx = b.x + dx
  const nz = b.z + dz
  const ncx = worldToCell(nx, GRID_W)
  const ncy = worldToCell(nz, GRID_H)

  if (!solid(ncx, ncy)) {
    if (isCrate(ncx, ncy)) return { kind: 'crate', cx: ncx, cy: ncy }
    return { kind: 'move', x: nx, z: nz, vx: b.vx, vz: b.vz, bounces: b.bounces }
  }

  let flipX: boolean
  let flipZ: boolean
  if (ncx !== ocx && ncy !== ocy) {
    // 斜向跨格：看兩側鄰格決定撞到哪一面；兩側同為牆或同為空（正撞角）就兩軸都反
    const sx = solid(ncx, ocy)
    const sz = solid(ocx, ncy)
    flipX = sx === sz ? true : sx
    flipZ = sx === sz ? true : sz
  } else {
    flipX = ncx !== ocx
    flipZ = ncy !== ocy
  }

  // 撞擊面：舊格往前進方向的邊界
  const faceX = cellToWorld(ocx, GRID_W) + Math.sign(b.vx) * (CELL / 2)
  const faceZ = cellToWorld(ocy, GRID_H) + Math.sign(b.vz) * (CELL / 2)
  let hitX = nx
  let hitZ = nz
  if (flipX && flipZ) {
    hitX = faceX
    hitZ = faceZ
  } else if (flipX) {
    const t = dx !== 0 ? (faceX - b.x) / dx : 0
    hitX = faceX
    hitZ = b.z + dz * t
  } else if (flipZ) {
    const t = dz !== 0 ? (faceZ - b.z) / dz : 0
    hitX = b.x + dx * t
    hitZ = faceZ
  }

  // 本來就在牆格內（牆落在子彈上），或反彈次數用完 → 消失
  if ((!flipX && !flipZ) || b.bounces >= BULLET_MAX_BOUNCE) return { kind: 'expire', hitX, hitZ }

  return {
    kind: 'bounce',
    x: flipX ? 2 * faceX - nx : nx,
    z: flipZ ? 2 * faceZ - nz : nz,
    vx: flipX ? -b.vx : b.vx,
    vz: flipZ ? -b.vz : b.vz,
    bounces: b.bounces + 1,
    hitX,
    hitZ,
  }
}

/** 拉回後與牆面保留的距離（避免落在格線上被 round 判回牆格） */
export const MUZZLE_EPS = 0.01

/**
 * 開火點校正：砲口偏移（0.6）大於坦克半徑（0.5），貼牆開火時砲口會落進牆格，
 * stepBullet 從牆內起步只能判消失。落在不可破牆或場外時，沿彈道反方向拉回到撞擊面前，
 * 下一步就照常撞面反彈。木箱不拉回（照舊由 stepBullet 判打掉）。
 */
export function clampMuzzle(x: number, z: number, vx: number, vz: number, isWall: CellPred): { x: number; z: number } {
  const solid = (cx: number, cy: number) => !inGrid(cx, cy) || isWall(cx, cy)
  const sp = Math.hypot(vx, vz)
  if (sp === 0) return { x, z }
  const bx = -vx / sp
  const bz = -vz / sp
  let px = x
  let pz = z
  // 砲口偏移遠小於一格，最多跨回一兩格；設上限防呆
  for (let i = 0; i < 4; i++) {
    const cx = worldToCell(px, GRID_W)
    const cy = worldToCell(pz, GRID_H)
    if (!solid(cx, cy)) return { x: px, z: pz }
    const gx = cellToWorld(cx, GRID_W)
    const gz = cellToWorld(cy, GRID_H)
    const tx = bx > 0 ? (gx + CELL / 2 - px) / bx : bx < 0 ? (gx - CELL / 2 - px) / bx : Infinity
    const tz = bz > 0 ? (gz + CELL / 2 - pz) / bz : bz < 0 ? (gz - CELL / 2 - pz) / bz : Infinity
    const t = Math.min(tx, tz) + MUZZLE_EPS
    px += bx * t
    pz += bz * t
  }
  return { x: px, z: pz }
}
