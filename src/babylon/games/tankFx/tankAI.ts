/**
 * 坦克電腦玩家決策（純函式，host 每 tick 對每台 bot 呼叫一次）。
 *
 * 優先序：
 * - 移動：子彈將在 AI_DODGE_MS 內擊中自己 → 橫移閃避；站在預告格 → 逃到最近安全格；
 *   否則沿格路徑走向最近的道具，沒有道具且看不到敵人就走向最近的敵人。
 *   尋路不經過牆（含已落牆格）與預告格；路被木箱擋住就停下打木箱。
 * - 砲塔：有直線視線的最近敵人 → 瞄準（誤差 ≤ AI_AIM_ERR_DEG），看到滿 AI_REACT_MS 且對準才開火；
 *   否則對準擋路的木箱開火。
 * 冷卻與 buff 由 host 的開火路徑另行把關，這裡只回答「想不想開火」。
 */
import {
  GRID_H,
  GRID_W,
  cellIdx,
  cellToWorld,
  inGrid,
  tankMoveBlocked,
  worldToCell,
  type CellPred,
} from '@/babylon/games/tankFx/grid'

export const AI_AIM_ERR_DEG = 8
export const AI_REACT_MS = 300
export const AI_DODGE_MS = 600

/** 子彈與坦克中心距離小於此值算命中（同 tank.ts 判定 0.7），閃避再多留餘裕 */
const DODGE_RADIUS = 1.0
/** 砲塔與目標角差小於此值才算對準 */
const AIM_TOLERANCE = 0.06
/** 有視線但距離超過此值（世界單位）時，邊瞄準邊沿路徑靠近 */
const ENGAGE_DIST = 10
const MAX_AIM_ERR = (AI_AIM_ERR_DEG * Math.PI) / 180
/** 換軸前先對齊格中心的容許偏差 */
const ALIGN_EPS = 0.15

export interface AiTank {
  id: string
  x: number
  z: number
}

export interface AiBullet {
  x: number
  z: number
  vx: number
  vz: number
  owner: string
  bounces: number
}

export interface TankAIInput {
  self: AiTank & { turretAngle: number }
  now: number
  /** 不可破牆（含已落牆格）；場外由本模組一律視為牆 */
  isWall: CellPred
  isCrate: CellPred
  /** 落牆預告格 */
  isDanger: CellPred
  /** 存活的其他坦克 */
  enemies: readonly AiTank[]
  bullets: readonly AiBullet[]
  items: readonly { cx: number; cy: number }[]
  /** [0,1) 亂數（瞄準誤差用） */
  rand: () => number
  /** 開火冷卻已好（host 依 FIRE_COOLDOWN_MS 與 buff 算）；省略視為 true */
  fireReady?: boolean
}

export interface TankAIMemory {
  targetId: string | null
  seenSince: number
  /** 本次鎖定的瞄準誤差（弧度），換目標才重抽，避免砲塔每 tick 抖動 */
  aimErr: number
}

export interface TankAIAction {
  /** 移動方向（軸向單位向量或 0） */
  moveX: number
  moveZ: number
  /** 砲塔目標角；null 表示維持現狀 */
  aim: number | null
  fire: boolean
}

export const createAIMemory = (): TankAIMemory => ({ targetId: null, seenSince: 0, aimErr: 0 })

const angleTo = (fx: number, fz: number, tx: number, tz: number) => Math.atan2(tx - fx, tz - fz)
const angleDiff = (a: number, b: number) => {
  const d = (a - b) % (Math.PI * 2)
  return Math.abs(d > Math.PI ? d - Math.PI * 2 : d < -Math.PI ? d + Math.PI * 2 : d)
}

/** 兩點之間沿直線每 0.25 取樣，經過 blocked 格即無視線 */
export function hasLineOfSight(ax: number, az: number, bx: number, bz: number, blocked: CellPred): boolean {
  const dist = Math.hypot(bx - ax, bz - az)
  const n = Math.ceil(dist / 0.25)
  for (let i = 1; i < n; i++) {
    const t = i / n
    const cx = worldToCell(ax + (bx - ax) * t, GRID_W)
    const cy = worldToCell(az + (bz - az) * t, GRID_H)
    if (!inGrid(cx, cy) || blocked(cx, cy)) return false
  }
  return true
}

const DIRS: [number, number][] = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
]

/** BFS：從 start 出發（start 本身不受限），回傳到第一個符合 isGoal 的格的路徑（含 start） */
function bfs(
  start: [number, number],
  passable: CellPred,
  isGoal: CellPred
): [number, number][] | null {
  const prev = new Map<number, number>()
  const s = cellIdx(start[0], start[1])
  prev.set(s, -1)
  const queue: number[] = [s]
  for (let head = 0; head < queue.length; head++) {
    const cur = queue[head]
    const cx = cur % GRID_W
    const cy = Math.floor(cur / GRID_W)
    if (cur !== s && isGoal(cx, cy)) {
      const path: [number, number][] = []
      for (let k = cur; k !== -1; k = prev.get(k) as number) path.push([k % GRID_W, Math.floor(k / GRID_W)])
      return path.reverse()
    }
    for (const [dx, dy] of DIRS) {
      const nx = cx + dx
      const ny = cy + dy
      if (!inGrid(nx, ny) || !passable(nx, ny)) continue
      const ni = cellIdx(nx, ny)
      if (prev.has(ni)) continue
      prev.set(ni, cur)
      queue.push(ni)
    }
  }
  return null
}

/** 子彈威脅：回傳要閃的那發（AI_DODGE_MS 內最接近距離 < DODGE_RADIUS 且中間無牆） */
function threat(input: TankAIInput): AiBullet | null {
  const { self } = input
  for (const b of input.bullets) {
    if (b.owner === self.id && b.bounces === 0) continue
    const v2 = b.vx * b.vx + b.vz * b.vz
    if (v2 === 0) continue
    const rx = self.x - b.x
    const rz = self.z - b.z
    const along = rx * b.vx + rz * b.vz
    if (along <= 0) continue
    const t = Math.min(along / v2, AI_DODGE_MS / 1000)
    const px = b.x + b.vx * t - self.x
    const pz = b.z + b.vz * t - self.z
    if (Math.hypot(px, pz) >= DODGE_RADIUS) continue
    if (!hasLineOfSight(b.x, b.z, self.x, self.z, input.isWall)) continue
    return b
  }
  return null
}

export function decideTankBot(input: TankAIInput, memory: TankAIMemory): { action: TankAIAction; memory: TankAIMemory } {
  const { self, now } = input
  const scx = worldToCell(self.x, GRID_W)
  const scy = worldToCell(self.z, GRID_H)
  const wall = (cx: number, cy: number) => !inGrid(cx, cy) || input.isWall(cx, cy)
  const losBlock = (cx: number, cy: number) => wall(cx, cy) || input.isCrate(cx, cy)

  // ---- 目標與砲塔 ----
  let target: AiTank | null = null
  let best = Infinity
  for (const e of input.enemies) {
    if (!hasLineOfSight(self.x, self.z, e.x, e.z, losBlock)) continue
    const d = Math.hypot(e.x - self.x, e.z - self.z)
    if (d < best) {
      best = d
      target = e
    }
  }
  let mem: TankAIMemory
  if (!target) mem = { targetId: null, seenSince: 0, aimErr: 0 }
  else if (target.id !== memory.targetId) {
    mem = { targetId: target.id, seenSince: now, aimErr: (input.rand() * 2 - 1) * MAX_AIM_ERR }
  } else mem = { ...memory }

  let aim: number | null = null
  let fire = false
  if (target) {
    aim = angleTo(self.x, self.z, target.x, target.z) + mem.aimErr
    fire =
      (input.fireReady ?? true) &&
      now - mem.seenSince >= AI_REACT_MS &&
      angleDiff(self.turretAngle, aim) < AIM_TOLERANCE
    // 每發重抽誤差：同一目標不會永遠偏同一邊
    if (fire) mem.aimErr = (input.rand() * 2 - 1) * MAX_AIM_ERR
  }

  // ---- 移動 ----
  let moveX = 0
  let moveZ = 0
  const danger = (cx: number, cy: number) => inGrid(cx, cy) && input.isDanger(cx, cy)
  const dangerAt = (x: number, z: number) => danger(worldToCell(x, GRID_W), worldToCell(z, GRID_H))
  const blockedAt = (x: number, z: number) =>
    tankMoveBlocked(self.x, self.z, x, z, (cx, cy) => wall(cx, cy) || input.isCrate(cx, cy))

  const bullet = threat(input)
  if (bullet) {
    const len = Math.hypot(bullet.vx, bullet.vz)
    const px = -bullet.vz / len
    const pz = bullet.vx / len
    // 往離彈道較遠的一側閃；那側會卡住或會走進預告格就換另一側
    const side = (self.x - bullet.x) * px + (self.z - bullet.z) * pz >= 0 ? 1 : -1
    for (const s of [side, -side]) {
      const dx = px * s
      const dz = pz * s
      if (blockedAt(self.x + dx * 0.6, self.z + dz * 0.6)) continue
      if (dangerAt(self.x + dx * DODGE_LOOKAHEAD, self.z + dz * DODGE_LOOKAHEAD)) continue
      moveX = round(dx)
      moveZ = round(dz)
      break
    }
    return { action: { moveX, moveZ, aim, fire }, memory: mem }
  }

  const passable = (cx: number, cy: number) => !wall(cx, cy) && !danger(cx, cy)
  let path: [number, number][] | null = null
  if (danger(scx, scy)) {
    path = bfs([scx, scy], (cx, cy) => !wall(cx, cy), (cx, cy) => !danger(cx, cy) && !input.isCrate(cx, cy))
  } else if (input.items.length > 0) {
    const goals = new Set(input.items.map((i) => cellIdx(i.cx, i.cy)))
    path = goals.has(cellIdx(scx, scy)) ? null : bfs([scx, scy], passable, (cx, cy) => goals.has(cellIdx(cx, cy)))
  }
  const approach = !target || best > ENGAGE_DIST
  if (!path && approach && input.enemies.length > 0 && !danger(scx, scy)) {
    const goals = new Set(input.enemies.map((e) => cellIdx(worldToCell(e.x, GRID_W), worldToCell(e.z, GRID_H))))
    path = bfs([scx, scy], passable, (cx, cy) => goals.has(cellIdx(cx, cy)))
  }

  if (path && path.length > 1) {
    const [nx, ny] = path[1]
    if (input.isCrate(nx, ny)) {
      // 路被木箱擋住：停下對準木箱開火（沒有敵人目標時才換砲塔目標）
      if (!target) {
        aim = angleTo(self.x, self.z, cellToWorld(nx, GRID_W), cellToWorld(ny, GRID_H))
        fire = angleDiff(self.turretAngle, aim) < AIM_TOLERANCE * 2
      }
    } else {
      const ccx = cellToWorld(scx, GRID_W)
      const ccz = cellToWorld(scy, GRID_H)
      if (nx !== scx) {
        const off = ccz - self.z
        if (Math.abs(off) > ALIGN_EPS) moveZ = Math.sign(off)
        else moveX = Math.sign(cellToWorld(nx, GRID_W) - self.x)
      } else {
        const off = ccx - self.x
        if (Math.abs(off) > ALIGN_EPS) moveX = Math.sign(off)
        else moveZ = Math.sign(cellToWorld(ny, GRID_H) - self.z)
      }
    }
  }

  return { action: { moveX, moveZ, aim, fire }, memory: mem }
}

/** 閃避時檢查「往那側走會不會進預告格」的前瞻距離 */
const DODGE_LOOKAHEAD = 1.2
const round = (v: number) => Math.round(v * 1e6) / 1e6
