/**
 * 賽車網路訊息解碼（brief AC6b 訊息表）。對端訊息一律不可信：
 * 形狀與範圍驗不過回 null（呼叫端靜默丟棄），絕不 throw；「只信房主」由呼叫端以 from 判斷。
 */
import { isArrayOf, isIntIn, isNum, isNumIn, isObj, isOneOf, isStr } from '@/babylon/net'
import { ITEM_KINDS, SHELL_SPEED, type ItemKind } from '@/babylon/games/raceRules/items'
import { MAX_RACERS, type RaceRosterEntry } from '@/babylon/games/raceRules/roster'
import { CHECKPOINTS, LAPS } from '@/babylon/games/raceRules/track'
import { RACE_BOUND } from '@/babylon/games/raceRules/trackData'

/** own.fin 上限（host 驗範圍 0–600000，AC6） */
export const OWN_FIN_MAX = 600000
/** 座標容許：場地半邊長再放寬一點（出界那一 tick 會被夾回） */
const WX = RACE_BOUND.x + 5
const WZ = RACE_BOUND.z + 5
/** 道具速度上限（龜殼 SHELL_SPEED，留兩倍餘裕） */
const VEL_MAX = SHELL_SPEED * 2
/** 打滑毫秒上限 */
const SPIN_MAX_MS = 5000
/** 場上道具同時上限（香蕉 8 + 龜殼，留餘裕） */
const ITEM_LIST_MAX = 64
const ITEM_ID_MAX = 32
const BOT_ID = /^bot-[0-3]$/

export type DriftTier = 0 | 1 | 2 | 3

/** 各車本機擁有、20Hz 廣播的狀態 */
export interface RaceOwn {
  x: number
  z: number
  ry: number
  lap: number
  cp: number
  s: number
  fin: number | null
  ghost: boolean
  drift: DriftTier
  boost: boolean
  spin: boolean
  shield: boolean
}

export interface BotSnap {
  id: string
  x: number
  z: number
  ry: number
  lap: number
  cp: number
  s: number
  fin: number | null
  drift: DriftTier
  spin: boolean
}

export type ItemGoneReason = 'hit' | 'expire' | 'clash'
export const ITEM_GONE_REASONS: readonly ItemGoneReason[] = ['hit', 'expire', 'clash']

export interface ItemSpawnMsg {
  id: string
  kind: 'banana' | 'shell'
  owner: string
  x: number
  z: number
  vx: number
  vz: number
  target: string | null
}

export interface RaceStanding {
  id: string
  name: string
  colorIndex: 0 | 1 | 2 | 3
  rank: number
  totalMs: number | null
  bestLapMs: number | null
}

const isBool = (v: unknown): v is boolean => typeof v === 'boolean'
const isFin = (v: unknown): v is number | null => v === null || isNumIn(v, 0, OWN_FIN_MAX)
const inWorld = (x: unknown, z: unknown) => isNumIn(x, -WX, WX) && isNumIn(z, -WZ, WZ)
/** lap／cp／s 三件組 */
const isProgress = (p: Record<string, unknown>, len: number) =>
  isIntIn(p.lap, 0, LAPS) && isIntIn(p.cp, 0, CHECKPOINTS - 1) && isNumIn(p.s, 0, len)

export function decodeOwn(p: unknown, len: number): RaceOwn | null {
  if (!isObj(p) || !inWorld(p.x, p.z) || !isNum(p.ry) || !isProgress(p, len) || !isFin(p.fin)) return null
  if (!isIntIn(p.drift, 0, 3) || !isBool(p.ghost) || !isBool(p.boost) || !isBool(p.spin) || !isBool(p.shield)) return null
  return {
    x: p.x as number,
    z: p.z as number,
    ry: p.ry,
    lap: p.lap as number,
    cp: p.cp as number,
    s: p.s as number,
    fin: p.fin,
    ghost: p.ghost,
    drift: p.drift as DriftTier,
    boost: p.boost,
    spin: p.spin,
    shield: p.shield,
  }
}

export function decodeStart(p: unknown): { bots: RaceRosterEntry[] } | null {
  if (!isObj(p)) return null
  if (p.bots === undefined) return { bots: [] }
  const bots = p.bots
  const ok = isArrayOf<RaceRosterEntry>(bots, (b) => isObj(b) && isStr(b.id) && BOT_ID.test(b.id) && isStr(b.name, 32), MAX_RACERS)
  if (!ok) return null
  return { bots: bots.map((b) => ({ id: b.id, name: b.name })) }
}

export function decodeBotState(p: unknown, botIds: readonly string[], len: number): { states: BotSnap[] } | null {
  if (!isObj(p)) return null
  const states = p.states
  const ok = isArrayOf<Record<string, unknown>>(
    states,
    (s) =>
      isObj(s) &&
      isStr(s.id) &&
      botIds.includes(s.id) &&
      inWorld(s.x, s.z) &&
      isNum(s.ry) &&
      isProgress(s, len) &&
      isFin(s.fin) &&
      isIntIn(s.drift, 0, 3) &&
      isBool(s.spin),
    MAX_RACERS
  )
  if (!ok) return null
  return {
    states: states.map((s) => ({
      id: s.id as string,
      x: s.x as number,
      z: s.z as number,
      ry: s.ry as number,
      lap: s.lap as number,
      cp: s.cp as number,
      s: s.s as number,
      fin: s.fin as number | null,
      drift: s.drift as DriftTier,
      spin: s.spin as boolean,
    })),
  }
}

export function decodeItemReq(p: unknown, boxCount: number): { box: number } | null {
  if (!isObj(p) || !isIntIn(p.box, 0, boxCount - 1)) return null
  return { box: p.box }
}

export function decodeItemGrant(
  p: unknown,
  boxCount: number,
  ids: readonly string[]
): { box: number; who: string; kind: ItemKind } | null {
  if (!isObj(p) || !isIntIn(p.box, 0, boxCount - 1) || !isStr(p.who) || !ids.includes(p.who)) return null
  if (!isOneOf<ItemKind>(p.kind, ITEM_KINDS)) return null
  return { box: p.box, who: p.who, kind: p.kind }
}

export function decodeUseItem(p: unknown): { kind: ItemKind } | null {
  if (!isObj(p) || !isOneOf<ItemKind>(p.kind, ITEM_KINDS)) return null
  return { kind: p.kind }
}

export function decodeItemSpawn(p: unknown, ids: readonly string[]): ItemSpawnMsg | null {
  if (!isObj(p) || !isStr(p.id, ITEM_ID_MAX) || !isOneOf<'banana' | 'shell'>(p.kind, ['banana', 'shell'])) return null
  if (!isStr(p.owner) || !ids.includes(p.owner) || !inWorld(p.x, p.z)) return null
  if (!isNumIn(p.vx, -VEL_MAX, VEL_MAX) || !isNumIn(p.vz, -VEL_MAX, VEL_MAX)) return null
  const target = p.target ?? null
  if (target !== null && !(isStr(target) && ids.includes(target))) return null
  return { id: p.id, kind: p.kind, owner: p.owner, x: p.x as number, z: p.z as number, vx: p.vx, vz: p.vz, target }
}

export function decodeItemState(p: unknown): { list: { id: string; x: number; z: number }[] } | null {
  if (!isObj(p)) return null
  const list = p.list
  const ok = isArrayOf<Record<string, unknown>>(list, (e) => isObj(e) && isStr(e.id, ITEM_ID_MAX) && inWorld(e.x, e.z), ITEM_LIST_MAX)
  if (!ok) return null
  return { list: list.map((e) => ({ id: e.id as string, x: e.x as number, z: e.z as number })) }
}

export function decodeItemGone(p: unknown): { id: string; reason: ItemGoneReason } | null {
  if (!isObj(p) || !isStr(p.id, ITEM_ID_MAX) || !isOneOf<ItemGoneReason>(p.reason, ITEM_GONE_REASONS)) return null
  return { id: p.id, reason: p.reason }
}

export function decodeSpin(p: unknown, ids: readonly string[]): { target: string; ms: number; blocked: boolean } | null {
  if (!isObj(p) || !isStr(p.target) || !ids.includes(p.target) || !isNumIn(p.ms, 0, SPIN_MAX_MS)) return null
  if (p.blocked !== undefined && !isBool(p.blocked)) return null
  return { target: p.target, ms: p.ms, blocked: p.blocked === true }
}

export function decodeBoxState(p: unknown, boxCount: number): { taken: number[] } | null {
  if (!isObj(p)) return null
  const taken = p.taken
  if (!isArrayOf<number>(taken, (v) => isIntIn(v, 0, boxCount - 1), boxCount)) return null
  if (new Set(taken).size !== taken.length) return null
  return { taken: [...taken] }
}

export function decodeResult(p: unknown): RaceStanding[] | null {
  const ok = isArrayOf<Record<string, unknown>>(
    p,
    (r) =>
      isObj(r) &&
      isStr(r.id) &&
      isStr(r.name, 64) &&
      isIntIn(r.colorIndex, 0, 3) &&
      isIntIn(r.rank, 1, MAX_RACERS) &&
      isFin(r.totalMs) &&
      isFin(r.bestLapMs),
    MAX_RACERS
  )
  if (!ok) return null
  return p.map((r) => ({
    id: r.id as string,
    name: r.name as string,
    colorIndex: r.colorIndex as 0 | 1 | 2 | 3,
    rank: r.rank as number,
    totalMs: r.totalMs as number | null,
    bestLapMs: r.bestLapMs as number | null,
  }))
}
