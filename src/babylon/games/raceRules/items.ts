/**
 * 賽車道具（純函式，host 裁決）：道具箱先到先得、落後補償抽道具、龜殼目標與移動、命中判定。
 * 同步流程見 brief AC4／AC6b：guest 只送 itemReq／useItem，命中只信 host 廣播的 spin。
 */
import { MINI_TURBO_MS, type DriftState, type RacerState } from '@/babylon/games/raceRules/drive'
import { ITEM_ODDS } from '@/babylon/games/raceRules/trackData'
import { placeAt, trackProgress, wrapAngle, type Course, type Track } from '@/babylon/games/raceRules/track'

export type ItemKind = 'banana' | 'shell' | 'mushroom' | 'shield'
/** 抽道具時累加機率的固定順序（各端一致） */
export const ITEM_KINDS: readonly ItemKind[] = ['banana', 'shell', 'mushroom', 'shield']

export const BOXES_PER_ROW = 4
export const ITEM_RESPAWN_MS = 3000
export const SPIN_MS = 800
export const SHELL_SPIN_MS = SPIN_MS * 1.5
export const SHELL_LIFE_MS = 6000
export const SHIELD_MS = 8000
export const MUSHROOM_MS = MINI_TURBO_MS[1]

// 數值見 spec §1.6／§2.2
/** 車碰到道具箱的距離 */
export const BOX_RADIUS = 1.4
export const BANANA_RADIUS = 0.9
export const SHELL_RADIUS = 0.8
/** 香蕉丟出後這段時間內不會打到丟的人 */
export const BANANA_ARM_MS = 400
/** 場上香蕉上限，超過時最舊的消失（itemGone reason 'expire'） */
export const BANANA_MAX = 8
/** 香蕉落在車後的距離、龜殼生成在車前的距離 */
export const BANANA_BACK = 2.2
export const SHELL_FRONT = 1.8
/** 龜殼速度（快過 BOOST_SPEED 22 才追得上） */
export const SHELL_SPEED = 26
/** 與目標距離小於此值改為直接追（轉速上限 SHELL_TURN rad/s）；否則沿中心線前進、lateral 以 SHELL_LAT_RATE/s 收斂到 0 */
export const SHELL_HOME_DIST = 10
export const SHELL_TURN = 6
export const SHELL_LAT_RATE = 4
/** 直射龜殼離開路緣外多遠就消失 */
export const SHELL_EDGE_OUT = 0.5

export interface ItemBox {
  id: number
  x: number
  z: number
}

/** 道具箱位置：每列 BOXES_PER_ROW 個，橫向均分路寬；id = 列 × BOXES_PER_ROW + 序 */
export function boxLayout(course: Course): ItemBox[] {
  const w = course.track.width
  return course.itemRows.flatMap((s, row) =>
    Array.from({ length: BOXES_PER_ROW }, (_, i) => {
      const p = placeAt(course.track, s, ((i + 0.5) / BOXES_PER_ROW - 0.5) * w)
      return { id: row * BOXES_PER_ROW + i, x: p.x, z: p.z }
    })
  )
}

/**
 * host：先到先得。respawnAt[box] > now 表示被撿走中；手上已有道具不給，箱子留著。
 * 給出時 respawnAt[box] = now + ITEM_RESPAWN_MS。不改動輸入。
 */
export function claimBox(
  respawnAt: readonly number[],
  box: number,
  holding: ItemKind | null,
  now: number
): { ok: boolean; respawnAt: number[] } {
  const ok = Number.isInteger(box) && box >= 0 && box < respawnAt.length && holding === null && respawnAt[box] <= now
  const next = [...respawnAt]
  if (ok) next[box] = now + ITEM_RESPAWN_MS
  return { ok, respawnAt: next }
}

/** boxState 廣播用：目前被撿走中的箱 id（升冪） */
export const takenBoxes = (respawnAt: readonly number[], now: number): number[] =>
  respawnAt.flatMap((t, i) => (t > now ? [i] : []))

/** 本機碰撞：碰到的第一個未被撿走的箱 id；guest 據此送 itemReq */
export function touchedBox(boxes: readonly ItemBox[], taken: readonly number[], x: number, z: number): number | null {
  for (const b of boxes) {
    if (taken.includes(b.id)) continue
    if (Math.hypot(b.x - x, b.z - z) <= BOX_RADIUS) return b.id
  }
  return null
}

/** 名次 → ITEM_ODDS 檔（spec §2.1）：第 1 名 0、最後一名 3，中間依 (rank−1)/(total−1) ≤ 0.5 分 1／2 */
export function rollTier(rank: number, total: number): 0 | 1 | 2 | 3 {
  const n = Math.max(1, Math.floor(total))
  const k = Math.min(n, Math.max(1, Math.floor(rank)))
  if (k === 1) return 0
  if (k === n) return 3
  return (k - 1) / (n - 1) <= 0.5 ? 1 : 2
}

/** 落後補償：依名次分檔查 ITEM_ODDS，r ∈ [0,1) 依 banana→shell→mushroom→shield 累加抽取 */
export function rollItem(rank: number, total: number, r: number): ItemKind {
  const row = ITEM_ODDS[rollTier(rank, total)]
  const x = Number.isFinite(r) ? Math.min(Math.max(r, 0), 1 - 1e-9) : 0
  let acc = 0
  let last: ItemKind = 'banana'
  for (const kind of ITEM_KINDS) {
    if (row[kind] <= 0) continue
    last = kind
    acc += row[kind]
    if (x < acc) return kind
  }
  return last
}

/** 紅龜殼目標：名次（order，第一名在前）在自己前面、最近且不在 skip 內的車；自己第一名或找不到回 null（直線前射） */
export function shellTarget(shooter: string, order: readonly string[], skip: ReadonlySet<string> = new Set()): string | null {
  const idx = order.indexOf(shooter)
  for (let i = idx - 1; i >= 0; i--) if (!skip.has(order[i])) return order[i]
  return null
}

/** 生成位置與初速：香蕉在車後靜止，龜殼在車前沿車頭方向 */
export function spawnItem(
  kind: 'banana' | 'shell',
  car: { x: number; z: number; ry: number }
): { x: number; z: number; vx: number; vz: number } {
  const fx = Math.sin(car.ry)
  const fz = Math.cos(car.ry)
  if (kind === 'banana') return { x: car.x - fx * BANANA_BACK, z: car.z - fz * BANANA_BACK, vx: 0, vz: 0 }
  return { x: car.x + fx * SHELL_FRONT, z: car.z + fz * SHELL_FRONT, vx: fx * SHELL_SPEED, vz: fz * SHELL_SPEED }
}

export interface Shell {
  id: string
  owner: string
  /** null = 直線前射 */
  target: string | null
  ageMs: number
  x: number
  z: number
  vx: number
  vz: number
}

/**
 * host：龜殼一個 tick（spec §2.2）。
 * - 無目標（或目標已不在場）：沿 (vx, vz) 直線
 * - 目標距離 ≥ SHELL_HOME_DIST：沿中心線 s 往前推 SHELL_SPEED·dt，lateral 以 SHELL_LAT_RATE/s 收斂到 0
 * - 目標距離 < SHELL_HOME_DIST：朝目標轉向（每秒最多 SHELL_TURN rad），速度 SHELL_SPEED
 */
export function stepShell(sh: Shell, targetPos: { x: number; z: number } | null, track: Track, dt: number): Shell {
  const ageMs = sh.ageMs + dt * 1000
  if (sh.target === null || !targetPos) return { ...sh, ageMs, x: sh.x + sh.vx * dt, z: sh.z + sh.vz * dt }
  const dx = targetPos.x - sh.x
  const dz = targetPos.z - sh.z
  if (Math.hypot(dx, dz) < SHELL_HOME_DIST) {
    const cur = Math.atan2(sh.vx, sh.vz)
    const want = Math.atan2(dx, dz)
    const maxTurn = SHELL_TURN * dt
    const heading = cur + Math.max(-maxTurn, Math.min(maxTurn, wrapAngle(want - cur)))
    const vx = Math.sin(heading) * SHELL_SPEED
    const vz = Math.cos(heading) * SHELL_SPEED
    return { ...sh, ageMs, vx, vz, x: sh.x + vx * dt, z: sh.z + vz * dt }
  }
  const p = trackProgress(track, sh.x, sh.z)
  const step = SHELL_LAT_RATE * dt
  const lateral = Math.abs(p.lateral) <= step ? 0 : p.lateral - Math.sign(p.lateral) * step
  const next = placeAt(track, p.s + SHELL_SPEED * dt, lateral)
  return { ...sh, ageMs, vx: (next.x - sh.x) / dt, vz: (next.z - sh.z) / dt, x: next.x, z: next.z }
}

/** 龜殼壽命到、出場地，或直射的離開路緣外 SHELL_EDGE_OUT */
export function shellGone(sh: Shell, course: Course): boolean {
  if (sh.ageMs >= SHELL_LIFE_MS) return true
  if (Math.abs(sh.x) > course.bound.x || Math.abs(sh.z) > course.bound.z) return true
  if (sh.target !== null) return false
  return Math.abs(trackProgress(course.track, sh.x, sh.z).lateral) > course.track.width / 2 + SHELL_EDGE_OUT
}

/** 龜殼撞到的香蕉（最近的一根）；兩者都要 itemGone */
export function shellBananaClash(sh: { x: number; z: number }, bananas: readonly { id: string; x: number; z: number }[]): string | null {
  let best: string | null = null
  let bestD = SHELL_RADIUS + BANANA_RADIUS
  for (const b of bananas) {
    const d = Math.hypot(b.x - sh.x, b.z - sh.z)
    if (d <= bestD) {
      best = b.id
      bestD = d
    }
  }
  return best
}

/** 場上香蕉（依生成先後）超過 BANANA_MAX 時該移除的最舊幾根 */
export const bananaOverflow = (ids: readonly string[]): string[] => ids.slice(0, Math.max(0, ids.length - BANANA_MAX))

export interface HitCar {
  id: string
  x: number
  z: number
  ghost: boolean
  shield: boolean
}

export interface FieldItem {
  kind: 'banana' | 'shell'
  owner: string
  /** 追蹤中的龜殼只撞這台；省略或 null = 撞任何車（香蕉、直射龜殼） */
  target?: string | null
  x: number
  z: number
  ageMs: number
}

export interface Hit {
  target: string
  ms: number
  blocked: boolean
}

/**
 * host：場上道具對各車（以最近收到的 own／botState 快照）的命中。
 * ghost 不中；追蹤中的龜殼只撞目標（spec §2.2）；龜殼不打自己，香蕉丟出 BANANA_ARM_MS 後才會打到自己；多台取最近、等距依 id。
 * 有護盾 → blocked、ms 0。命中與擋下道具都消失。
 */
export function hitTest(item: FieldItem, cars: readonly HitCar[]): Hit | null {
  const radius = item.kind === 'banana' ? BANANA_RADIUS : SHELL_RADIUS
  let best: HitCar | null = null
  let bestD = Infinity
  for (const c of cars) {
    if (c.ghost) continue
    if (item.kind === 'shell' && item.target && c.id !== item.target) continue
    if (c.id === item.owner && (item.kind === 'shell' || item.ageMs < BANANA_ARM_MS)) continue
    const d = Math.hypot(c.x - item.x, c.z - item.z)
    if (d > radius) continue
    if (d < bestD || (d === bestD && best && c.id < best.id)) {
      best = c
      bestD = d
    }
  }
  if (!best) return null
  if (best.shield) return { target: best.id, ms: 0, blocked: true }
  return { target: best.id, ms: item.kind === 'banana' ? SPIN_MS : SHELL_SPIN_MS, blocked: false }
}

const NO_DRIFT: DriftState = { charge: 0, tier: 0 }

/** 受擊者本機套用 host 的 spin：擋下只消耗護盾；否則打滑、清掉甩尾蓄力與加速 */
export function applySpin(r: RacerState, ms: number, blocked: boolean): RacerState {
  if (blocked) return { ...r, shieldMs: 0 }
  return { ...r, spinMs: Math.max(r.spinMs, ms), boostMs: 0, drift: NO_DRIFT }
}

/** 使用道具對自己的效果：加速菇、護盾在本機立即生效；香蕉／龜殼由 host 生成，不改自己 */
export function useItemSelf(r: RacerState, kind: ItemKind): RacerState {
  if (kind === 'mushroom') return { ...r, boostMs: Math.max(r.boostMs, MUSHROOM_MS) }
  if (kind === 'shield') return { ...r, shieldMs: SHIELD_MS }
  return r
}
