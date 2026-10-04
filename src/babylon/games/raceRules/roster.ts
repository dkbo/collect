/**
 * 賽車名冊：bot 補位與固定 4 色（AC7）。
 * 配色推導只讀 import bomberFx/palette 的 colorIndexOf，與炸彈超人、坦克同規則；
 * 實體序同時決定發車格（Course.grid[序]）。
 */
import { colorIndexOf } from '@/babylon/games/bomberFx/palette'
import type { ColorIndex } from '@/babylon/fx/palette'

export interface RaceRosterEntry {
  id: string
  name: string
}

/** 場上車數上限（含 bot） */
export const MAX_RACERS = 4

/** host：依真人數補滿 4 台（bot-0.. ／電腦1..） */
export function makeRaceBots(humanCount: number): RaceRosterEntry[] {
  const count = Math.max(0, MAX_RACERS - humanCount)
  return Array.from({ length: count }, (_, i) => ({ id: `bot-${i}`, name: `電腦${i + 1}` }))
}

/** 實體序：ctx.players 依序在前、bots 依序在後 */
export const raceEntityIds = (players: readonly { id: string }[], bots: readonly { id: string }[]): string[] => [
  ...players.map((p) => p.id),
  ...bots.map((b) => b.id),
]

export const raceColorIndex = (
  id: string,
  players: readonly { id: string }[],
  bots: readonly { id: string }[]
): ColorIndex => colorIndexOf(id, raceEntityIds(players, bots))
