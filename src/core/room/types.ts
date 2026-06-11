import type { Timestamp } from 'firebase/firestore'

/** 房間生命週期狀態 */
export type RoomStatus = 'waiting' | 'playing' | 'ended'

/** 對戰遊戲類型 */
export type GameType = 'tank' | 'race' | 'bomber' | 'overcooked'

/** 房間人數上限（1~4 人 mesh，見計畫 §4.2） */
export const MAX_PLAYERS = 4

/** 房間文件：rooms/{roomId} */
export interface Room {
  roomId: string
  gameType: GameType
  hostId: string
  status: RoomStatus
  maxPlayers: number
  /** serverTimestamp；本地樂觀寫入到伺服器回填前可能為 null */
  createdAt: Timestamp | null
}

/** 玩家文件：rooms/{roomId}/players/{playerId}（playerId = 匿名 uid） */
export interface RoomPlayer {
  id: string
  name: string
  isHost: boolean
  joinedAt: Timestamp | null
}
