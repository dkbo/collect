/**
 * 坦克名冊：bot 補位、固定 4 色、結算排名（純函式）。
 * 配色推導只讀 import bomberFx/palette 的 colorIndexOf，與炸彈超人同規則。
 */
import { colorIndexOf } from '@/babylon/games/bomberFx/palette'
import type { ColorIndex } from '@/babylon/fx/palette'

export interface RosterEntry {
  id: string
  name: string
}

/** 場上坦克上限（含 bot） */
export const MAX_TANKS = 4

/** host：依真人數補滿 4 台（bot-0.. ／電腦1..），與 bomber 同規則 */
export function makeBots(humanCount: number): RosterEntry[] {
  const count = Math.max(0, MAX_TANKS - humanCount)
  return Array.from({ length: count }, (_, i) => ({ id: `bot-${i}`, name: `電腦${i + 1}` }))
}

/** 實體序：真人依序在前、bot 依序在後（出生角與配色共用） */
export const entityIds = (players: readonly { id: string }[], bots: readonly { id: string }[]): string[] => [
  ...players.map((p) => p.id),
  ...bots.map((b) => b.id),
]

export const tankColorIndex = (
  id: string,
  players: readonly { id: string }[],
  bots: readonly { id: string }[]
): ColorIndex => colorIndexOf(id, entityIds(players, bots))

export interface Standing {
  id: string
  name: string
  alive: boolean
  kills: number
}

/** 存活優先、再比擊殺；同分保持輸入（名冊）順序。不改動輸入 */
export const rankStandings = (list: readonly Standing[]): Standing[] =>
  [...list].sort((a, b) => Number(b.alive) - Number(a.alive) || b.kills - a.kills)

/** 勝負已定：2 實體以上（含 bot）且存活 ≤ 1。host 用來結算；guest 收到最後一則 destroyed 即凍結子彈，不再多預測反彈 */
export const roundDecided = (total: number, alive: number): boolean => total >= 2 && alive <= 1
