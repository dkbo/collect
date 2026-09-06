/**
 * 炸彈超人網路協定（純邏輯，無 Babylon / scene 依賴，node 可直接單測）。
 *
 * 職責：
 * - 定義 host → 全體廣播的各訊息 payload 型別（BomberPayloadMap），
 *   讓 host 端組 payload 時有編譯期檢查。
 * - 解碼／驗證對端送來的 payload（安全審查 C2）：格座標夾在盤面內、陣列限長、
 *   數值須為有限數；驗不過即回傳 null（整則丟棄），絕不 throw。
 * - 道具種類 ItemKind 亦定義於此（屬於封包欄位的合法值域）。
 *
 * 實際套用到場景狀態（建 mesh、改地圖、扣血）留在 bomber.ts。
 */
import {
  isArrayOf,
  isCell,
  isCellArray,
  isIntIn,
  isNum,
  isNumIn,
  isObj,
  isOneOf,
  isStr,
  isStrArray,
} from '@/babylon/net'
import { GRID_H, GRID_W } from './bomberMap'

export type ItemKind = 'bomb' | 'fire' | 'speed' | 'kick' | 'throw' | 'invincible'

/** 合法道具種類（網路封包驗證用） */
export const ITEM_KINDS = ['bomb', 'fire', 'speed', 'kick', 'throw', 'invincible'] as const

/** 場上實體（玩家 + bot）數量上限，作為 kills/bots 等陣列的長度上限 */
export const MAX_ENTITIES = 8
/** 炸彈移動（踢/丟）動畫時間上限（毫秒） */
export const MAX_BOMB_MOVE_MS = 10_000

/** 爆炸掉落的道具 */
export interface Drop {
  cx: number
  cy: number
  kind: ItemKind
}

/** 電腦玩家名冊項 */
export interface BotEntry {
  id: string
  name: string
}

/** host 廣播的單隻 bot 位置 */
export interface BotStateEntry {
  id: string
  x: number
  z: number
}

export interface SeedPayload {
  seed: number
  bots: BotEntry[]
}

export interface BotsPayload {
  states: BotStateEntry[]
}

export interface BombPayload {
  id: string
  cx: number
  cy: number
  owner: string
}

/** 格座標（blastCells 回傳唯讀 tuple，故一律以唯讀形式承接） */
export type Cell = readonly [number, number]

export interface BoomPayload {
  id: string
  cells: readonly Cell[]
  destroyed: readonly Cell[]
  damaged?: readonly Cell[]
  kills: string[]
  itemKills?: readonly Cell[]
  drops?: Drop[]
}

export interface BurnPayload {
  kills: string[]
}

export interface PickupPayload {
  ci: number
  who: string
}

export interface BombMovePayload {
  id: string
  toCx: number
  toCy: number
  durMs: number
  arc: number
}

export interface CloseWallPayload {
  cx: number
  cy: number
  kills: string[]
}

/** host → 全體的廣播訊息型別對照（hostBroadcast 依此檢查 payload 形狀） */
export interface BomberPayloadMap {
  seed: SeedPayload
  bots: BotsPayload
  bomb: BombPayload
  boom: BoomPayload
  burn: BurnPayload
  pickup: PickupPayload
  bombMove: BombMovePayload
  closeWall: CloseWallPayload
}

export type BomberMessageType = keyof BomberPayloadMap

/** 驗證通過的下行訊息（type 為判別欄位） */
export type BomberMessage = {
  [K in BomberMessageType]: { type: K } & BomberPayloadMap[K]
}[BomberMessageType]

/**
 * 解碼並驗證 host 廣播的下行訊息。
 * 回傳 null 代表 payload 不合法或 type 未知，呼叫端應整則丟棄。
 */
export const decodeBomberMessage = (type: string, payload: unknown): BomberMessage | null => {
  const p = payload
  if (!isObj(p)) return null

  if (type === 'seed') {
    if (!isNumIn(p.seed, 0, 0xffffffff)) return null
    // bots 不合法不整則丟棄，退回空名冊（維持既有行為）
    const bots = isArrayOf<BotEntry>(
      p.bots,
      (b) => isObj(b) && isStr(b.id) && isStr(b.name),
      MAX_ENTITIES
    )
      ? (p.bots as BotEntry[])
      : []
    return { type: 'seed', seed: p.seed, bots }
  }

  if (type === 'bots') {
    if (
      !isArrayOf<BotStateEntry>(
        p.states,
        (b) => isObj(b) && isStr(b.id) && isNum(b.x) && isNum(b.z),
        MAX_ENTITIES
      )
    )
      return null
    return { type: 'bots', states: p.states as BotStateEntry[] }
  }

  if (type === 'bomb') {
    if (!isStr(p.id) || !isStr(p.owner) || !isCell([p.cx, p.cy], GRID_W, GRID_H)) return null
    return { type: 'bomb', id: p.id, cx: p.cx as number, cy: p.cy as number, owner: p.owner }
  }

  if (type === 'boom') {
    if (!isStr(p.id)) return null
    if (!isCellArray(p.cells, GRID_W, GRID_H) || p.cells.length === 0) return null // 套用端讀 cells[0]
    if (!isCellArray(p.destroyed, GRID_W, GRID_H)) return null
    if (p.damaged !== undefined && !isCellArray(p.damaged, GRID_W, GRID_H)) return null
    if (p.itemKills !== undefined && !isCellArray(p.itemKills, GRID_W, GRID_H)) return null
    if (!isStrArray(p.kills, MAX_ENTITIES)) return null
    if (
      p.drops !== undefined &&
      !isArrayOf<Drop>(
        p.drops,
        (d) =>
          isObj(d) && isCell([d.cx, d.cy], GRID_W, GRID_H) && isOneOf<ItemKind>(d.kind, ITEM_KINDS),
        GRID_W * GRID_H
      )
    )
      return null
    return {
      type: 'boom',
      id: p.id,
      cells: p.cells,
      destroyed: p.destroyed,
      damaged: p.damaged as [number, number][] | undefined,
      itemKills: p.itemKills as [number, number][] | undefined,
      kills: p.kills,
      drops: p.drops as Drop[] | undefined,
    }
  }

  if (type === 'burn') {
    if (!isStrArray(p.kills, MAX_ENTITIES)) return null
    return { type: 'burn', kills: p.kills }
  }

  if (type === 'pickup') {
    if (!isIntIn(p.ci, 0, GRID_W * GRID_H - 1) || !isStr(p.who)) return null
    return { type: 'pickup', ci: p.ci, who: p.who }
  }

  if (type === 'bombMove') {
    if (!isStr(p.id) || !isCell([p.toCx, p.toCy], GRID_W, GRID_H)) return null
    if (!isNumIn(p.durMs, 0, MAX_BOMB_MOVE_MS) || !isNumIn(p.arc, 0, 10)) return null
    return {
      type: 'bombMove',
      id: p.id,
      toCx: p.toCx as number,
      toCy: p.toCy as number,
      durMs: p.durMs,
      arc: p.arc,
    }
  }

  if (type === 'closeWall') {
    if (!isCell([p.cx, p.cy], GRID_W, GRID_H) || !isStrArray(p.kills, MAX_ENTITIES)) return null
    return { type: 'closeWall', cx: p.cx as number, cy: p.cy as number, kills: p.kills }
  }

  return null
}

// ---- guest → host 的上行請求（host 只取方向/格，其餘一律重新裁決） ----

/** 放彈請求：只帶請求格 */
export const decodeBombReq = (payload: unknown): { cx: number; cy: number } | null => {
  if (!isObj(payload) || !isCell([payload.cx, payload.cy], GRID_W, GRID_H)) return null
  return { cx: payload.cx as number, cy: payload.cy as number }
}

/** 踢炸彈請求：帶炸彈格與方向（host 不信任格子，僅用來定位炸彈） */
export const decodeKickReq = (
  payload: unknown
): { cx: number; cy: number; dx: number; dy: number } | null => {
  if (!isObj(payload) || !isCell([payload.cx, payload.cy], GRID_W, GRID_H)) return null
  if (!isNum(payload.dx) || !isNum(payload.dy)) return null
  return {
    cx: payload.cx as number,
    cy: payload.cy as number,
    dx: payload.dx,
    dy: payload.dy,
  }
}

/** 丟炸彈請求：只帶面向方向 */
export const decodeThrowReq = (payload: unknown): { dx: number; dy: number } | null => {
  if (!isObj(payload) || !isNum(payload.dx) || !isNum(payload.dy)) return null
  return { dx: payload.dx, dy: payload.dy }
}
