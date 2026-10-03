/**
 * 坦克下行訊息解碼（host → guest）。只信任房主廣播之外，形狀與範圍也要先驗：
 * 驗不過回 null（呼叫端靜默丟棄），絕不 throw。新欄位一律可選，舊格式照收。
 */
import { isArrayOf, isIntIn, isNum, isNumIn, isObj, isOneOf, isStr } from '@/babylon/net'
import { ITEM_KINDS, type ItemKind } from '@/babylon/games/tankFx/combat'
import { GRID_H, GRID_W } from '@/babylon/games/tankFx/grid'
import { MAX_TANKS, type RosterEntry } from '@/babylon/games/tankFx/roster'

export interface Limits {
  worldLimit: number
  velLimit: number
}

const BOT_ID = /^bot-[0-3]$/

export function decodeSeed(p: unknown): { seed: number; bots: RosterEntry[] } | null {
  if (!isObj(p) || !isNumIn(p.seed, 0, 0xffffffff)) return null
  if (p.bots === undefined) return { seed: p.seed, bots: [] }
  if (!isArrayOf<RosterEntry>(p.bots, (b) => isObj(b) && isStr(b.id) && BOT_ID.test(b.id) && isStr(b.name, 20), MAX_TANKS)) {
    return null
  }
  return { seed: p.seed, bots: p.bots.map((b) => ({ id: b.id, name: b.name })) }
}

export interface BouncePayload {
  bulletId: string
  x: number
  z: number
  vx: number
  vz: number
}

export function decodeBounce(p: unknown, l: Limits): BouncePayload | null {
  if (!isObj(p) || !isStr(p.bulletId)) return null
  if (!isNumIn(p.x, -l.worldLimit, l.worldLimit) || !isNumIn(p.z, -l.worldLimit, l.worldLimit)) return null
  if (!isNumIn(p.vx, -l.velLimit, l.velLimit) || !isNumIn(p.vz, -l.velLimit, l.velLimit)) return null
  return { bulletId: p.bulletId, x: p.x, z: p.z, vx: p.vx, vz: p.vz }
}

export function decodeClose(p: unknown): { cx: number; cy: number } | null {
  if (!isObj(p) || !isIntIn(p.cx, 0, GRID_W - 1) || !isIntIn(p.cy, 0, GRID_H - 1)) return null
  return { cx: p.cx, cy: p.cy }
}

/** bulletId（可選）＝打掉這個木箱的子彈：guest 的子彈比 host 晚一個延遲，木箱先被刪就會穿過去，所以一併刪 */
export function decodeCrate(p: unknown): { ci: number; bulletId: string | null } | null {
  if (!isObj(p) || !isIntIn(p.ci, 0, GRID_W * GRID_H - 1)) return null
  if (p.bulletId !== undefined && !isStr(p.bulletId)) return null
  return { ci: p.ci, bulletId: p.bulletId ?? null }
}

export interface BotStateEntry {
  id: string
  x: number
  z: number
  ry: number
  ta: number
}

export function decodeBotState(p: unknown, botIds: readonly string[], l: Limits): { states: BotStateEntry[] } | null {
  if (!isObj(p)) return null
  const states = p.states
  const ok = isArrayOf<BotStateEntry>(
    states,
    (s) =>
      isObj(s) &&
      isStr(s.id) &&
      botIds.includes(s.id) &&
      isNumIn(s.x, -l.worldLimit, l.worldLimit) &&
      isNumIn(s.z, -l.worldLimit, l.worldLimit) &&
      isNum(s.ry) &&
      isNum(s.ta),
    MAX_TANKS
  )
  if (!ok) return null
  return { states: states.map((s) => ({ id: s.id, x: s.x, z: s.z, ry: s.ry, ta: s.ta })) }
}

export interface HitPayload {
  bulletId: string | null
  targetId: string
  hp: number
  killerId: string | null
  /** 擊退方向單位向量（舊格式為 0,0＝不擊退） */
  dirX: number
  dirZ: number
  shieldBroken: boolean
  /** 命中時仍在無敵中：不扣血、不重置無敵時間 */
  invuln: boolean
}

const optBool = (v: unknown): v is boolean | undefined => v === undefined || typeof v === 'boolean'
const optUnit = (v: unknown): v is number | undefined => v === undefined || isNumIn(v, -1.001, 1.001)

export function decodeHit(p: unknown): HitPayload | null {
  if (!isObj(p) || !isStr(p.targetId) || !isIntIn(p.hp, 0, 99)) return null
  if (!optUnit(p.dirX) || !optUnit(p.dirZ) || !optBool(p.shieldBroken) || !optBool(p.invuln)) return null
  return {
    bulletId: isStr(p.bulletId) ? p.bulletId : null,
    targetId: p.targetId,
    hp: p.hp,
    killerId: isStr(p.killerId) ? p.killerId : null,
    dirX: p.dirX ?? 0,
    dirZ: p.dirZ ?? 0,
    shieldBroken: p.shieldBroken ?? false,
    invuln: p.invuln ?? false,
  }
}

export function decodePickup(p: unknown): { ci: number; who: string; kind: ItemKind | null } | null {
  if (!isObj(p) || !isIntIn(p.ci, 0, GRID_W * GRID_H - 1) || !isStr(p.who)) return null
  if (p.kind === undefined) return { ci: p.ci, who: p.who, kind: null }
  if (!isOneOf<ItemKind>(p.kind, ITEM_KINDS)) return null
  return { ci: p.ci, who: p.who, kind: p.kind }
}

export interface BulletPayload {
  id: string
  owner: string
  x: number
  z: number
  vx: number
  vz: number
  /** 三連發的左右兩發（可選，舊格式為 false）：不重播砲口焰 */
  side: boolean
}

export function decodeBullet(p: unknown, l: Limits): BulletPayload | null {
  if (!isObj(p) || !isStr(p.id) || !isStr(p.owner)) return null
  if (!isNumIn(p.x, -l.worldLimit, l.worldLimit) || !isNumIn(p.z, -l.worldLimit, l.worldLimit)) return null
  if (!isNumIn(p.vx, -l.velLimit, l.velLimit) || !isNumIn(p.vz, -l.velLimit, l.velLimit)) return null
  if (!optBool(p.side)) return null
  return { id: p.id, owner: p.owner, x: p.x, z: p.z, vx: p.vx, vz: p.vz, side: p.side ?? false }
}

export function decodeItem(p: unknown): { cx: number; cy: number; kind: ItemKind } | null {
  if (!isObj(p) || !isIntIn(p.cx, 0, GRID_W - 1) || !isIntIn(p.cy, 0, GRID_H - 1)) return null
  if (!isOneOf<ItemKind>(p.kind, ITEM_KINDS)) return null
  return { cx: p.cx, cy: p.cy, kind: p.kind }
}
