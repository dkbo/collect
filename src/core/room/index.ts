/**
 * 房間控制平面：建房 / 加入 / 離開 / 設定 / 訂閱。
 * 資料模型：rooms/{roomId} + rooms/{roomId}/players/{playerId}（見 firestore.rules）。
 * 連上 WebRTC（Phase 2）後，遊戲同步不再經由 Firestore，房間僅作控制與 signaling。
 */
import {
  doc,
  collection,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  serverTimestamp,
  type Unsubscribe,
} from 'firebase/firestore'
import { ensureAuth, getDb } from '@/core/firebase'
import { MAX_PLAYERS, type GameType, type Room, type RoomPlayer, type RoomStatus } from './types'

/** roomId 字母表：去除易混淆字元（0/O/1/I），6 碼大寫英數 */
const ROOM_ID_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
const ROOM_ID_LENGTH = 6

const generateRoomId = (): string => {
  const bytes = new Uint8Array(ROOM_ID_LENGTH)
  crypto.getRandomValues(bytes)
  let id = ''
  for (let i = 0; i < ROOM_ID_LENGTH; i++) {
    id += ROOM_ID_ALPHABET[bytes[i] % ROOM_ID_ALPHABET.length]
  }
  return id
}

const roomRef = (roomId: string) => doc(getDb(), 'rooms', roomId)
const playersRef = (roomId: string) => collection(getDb(), 'rooms', roomId, 'players')
const playerRef = (roomId: string, playerId: string) =>
  doc(getDb(), 'rooms', roomId, 'players', playerId)

/**
 * 建立房間：產生唯一 roomId，寫入房間文件與自身（host）玩家文件。
 * 回傳 { roomId, selfId }。
 */
export const createRoom = async (
  name: string,
  gameType: GameType = 'tank'
): Promise<{ roomId: string; selfId: string }> => {
  const selfId = await ensureAuth()

  // 重試以避開極小機率的 roomId 碰撞
  let roomId = generateRoomId()
  for (let attempt = 0; attempt < 5; attempt++) {
    const existing = await getDoc(roomRef(roomId))
    if (!existing.exists()) break
    roomId = generateRoomId()
  }

  const room: Omit<Room, 'createdAt'> = {
    roomId,
    gameType,
    hostId: selfId,
    status: 'waiting',
    maxPlayers: MAX_PLAYERS,
  }
  await setDoc(roomRef(roomId), { ...room, createdAt: serverTimestamp() })
  await setDoc(playerRef(roomId, selfId), {
    name: name.trim() || '房主',
    isHost: true,
    joinedAt: serverTimestamp(),
  })
  return { roomId, selfId }
}

/** 加入錯誤碼，供 UI 顯示對應訊息 */
export type JoinError = 'not-found' | 'ended' | 'full' | 'in-progress'

/**
 * 加入既有房間：驗證存在、可加入、未滿後寫入自身玩家文件。
 * 失敗時 throw Error，message 為 JoinError 碼。
 */
export const joinRoom = async (
  roomIdRaw: string,
  name: string
): Promise<{ roomId: string; selfId: string }> => {
  const roomId = roomIdRaw.trim().toUpperCase()
  const selfId = await ensureAuth()

  const snap = await getDoc(roomRef(roomId))
  if (!snap.exists()) throw new Error('not-found' satisfies JoinError)
  const room = snap.data() as Room
  if (room.status === 'ended') throw new Error('ended' satisfies JoinError)
  if (room.status === 'playing') throw new Error('in-progress' satisfies JoinError)

  const players = await getDocs(playersRef(roomId))
  const alreadyIn = players.docs.some((d) => d.id === selfId)
  if (!alreadyIn && players.size >= (room.maxPlayers ?? MAX_PLAYERS)) {
    throw new Error('full' satisfies JoinError)
  }

  await setDoc(playerRef(roomId, selfId), {
    name: name.trim() || '玩家',
    isHost: false,
    joinedAt: serverTimestamp(),
  })
  return { roomId, selfId }
}

/**
 * 離開房間。一般玩家僅刪除自身玩家文件；
 * 房主離開則結束房間（僅能刪除房間文件與自己的玩家文件——
 * firestore.rules 規定玩家文件只能被本人刪除，房主無權刪除別人的那筆。
 * 其餘玩家的文件由各自的用戶端在 subscribeRoom 收到 room === null 時自行清理）。
 */
export const leaveRoom = async (roomId: string, selfId: string, isHost: boolean): Promise<void> => {
  await deleteDoc(playerRef(roomId, selfId))
  if (isHost) {
    await deleteDoc(roomRef(roomId))
  }
}

/** 房主更新遊戲類型 */
export const setGameType = (roomId: string, gameType: GameType): Promise<void> =>
  updateDoc(roomRef(roomId), { gameType })

/** 房主更新房間狀態（如開局 waiting→playing） */
export const setRoomStatus = (roomId: string, status: RoomStatus): Promise<void> =>
  updateDoc(roomRef(roomId), { status })

/** 訂閱房間文件變動；房間被刪除時以 null 回呼 */
export const subscribeRoom = (
  roomId: string,
  onChange: (room: Room | null) => void
): Unsubscribe =>
  onSnapshot(roomRef(roomId), (snap) => {
    onChange(snap.exists() ? (snap.data() as Room) : null)
  })

/** 訂閱玩家列表變動（依加入時間排序的成員） */
export const subscribePlayers = (
  roomId: string,
  onChange: (players: RoomPlayer[]) => void
): Unsubscribe =>
  onSnapshot(playersRef(roomId), (snap) => {
    const players = snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<RoomPlayer, 'id'>) }))
    players.sort((a, b) => (a.joinedAt?.toMillis() ?? 0) - (b.joinedAt?.toMillis() ?? 0))
    onChange(players)
  })

export { MAX_PLAYERS } from './types'
export type { GameType, Room, RoomPlayer, RoomStatus } from './types'
