/**
 * 廚房快手玩家配色（kitchen spec §4、裁決⑦）：colorIndex = 玩家在 ctx.players 的序號，
 * 與 respawn() 取出生點的 findIndex 同序，所以同一位玩家在每個 client 顏色一致。純函式，可在 node 單測。
 */
import { PLAYER_PALETTE, type ColorIndex } from '@/babylon/fx/palette'
import type { GamePlayer } from '@/babylon/types'

/** 找不到回 0（對齊 respawn 的 Math.max(0, idx)）；超過 4 人環繞 */
export function colorIndexIn(players: readonly GamePlayer[], id: string): ColorIndex {
  const idx = Math.max(0, players.findIndex((p) => p.id === id))
  return (idx % PLAYER_PALETTE.length) as ColorIndex
}

export interface RosterEntry {
  id: string
  name: string
  colorIndex: ColorIndex
  isSelf: boolean
}

/** 名冊（順序照 players）；selfId 只影響 isSelf，不影響顏色 */
export function kitchenRoster(players: readonly GamePlayer[], selfId: string): RosterEntry[] {
  return players.map((p, i) => ({
    id: p.id,
    name: p.name,
    colorIndex: (i % PLAYER_PALETTE.length) as ColorIndex,
    isSelf: p.id === selfId,
  }))
}
