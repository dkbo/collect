import { create } from 'zustand'
import type { Unsubscribe } from 'firebase/firestore'
import { isFirebaseConfigured } from '@/core/firebase'
import {
  createRoom,
  joinRoom,
  leaveRoom,
  setGameType,
  setRoomStatus,
  subscribePlayers,
  subscribeRoom,
  type GameType,
  type Room,
  type RoomPlayer,
} from '@/core/room'

/** JoinError 碼 → 使用者訊息 */
const JOIN_MESSAGES: Record<string, string> = {
  'not-found': '找不到房間，請確認房號是否正確',
  ended: '此房間已結束',
  full: '房間已滿（上限 4 人）',
  'in-progress': '遊戲進行中，目前無法加入',
}

const messageFor = (err: unknown): string => {
  const code = err instanceof Error ? err.message : String(err)
  return JOIN_MESSAGES[code] ?? '連線發生錯誤，請稍後再試'
}

interface RoomStore {
  /** Firebase 是否已設定（未設定時 UI 顯示提示，停用建房/加入） */
  configured: boolean
  selfId: string | null
  roomId: string | null
  room: Room | null
  players: RoomPlayer[]
  busy: boolean
  error: string | null
  /** 非自願離開（如房主關閉房間）時的提示，回到大廳顯示 */
  notice: string | null

  isHost: () => boolean
  create: (name: string) => Promise<void>
  join: (roomId: string, name: string) => Promise<void>
  leave: () => Promise<void>
  selectGame: (gameType: GameType) => Promise<void>
  startGame: () => Promise<void>
  clearError: () => void
  reset: () => void
}

// 訂閱控制留在模組層級（非反應式狀態，避免進 store 觸發 re-render）
let unsubRoom: Unsubscribe | null = null
let unsubPlayers: Unsubscribe | null = null

const stopSubs = () => {
  unsubRoom?.()
  unsubPlayers?.()
  unsubRoom = null
  unsubPlayers = null
}

const initialState = {
  configured: isFirebaseConfigured,
  selfId: null,
  roomId: null,
  room: null,
  players: [] as RoomPlayer[],
  busy: false,
  error: null,
  notice: null,
}

export const useRoomStore = create<RoomStore>((set, get) => {
  const startSubs = (roomId: string) => {
    stopSubs()
    unsubRoom = subscribeRoom(roomId, (room) => {
      if (room === null) {
        // 房間被房主結束/刪除 → 退回大廳並提示（自願離開時已先 stopSubs，不會走到這）
        stopSubs()
        set({ ...initialState, selfId: get().selfId, notice: '房主已關閉房間' })
        return
      }
      set({ room })
    })
    unsubPlayers = subscribePlayers(roomId, (players) => set({ players }))
  }

  return {
    ...initialState,

    isHost: () => {
      const { room, selfId } = get()
      return !!selfId && room?.hostId === selfId
    },

    create: async (name) => {
      set({ busy: true, error: null, notice: null })
      try {
        const { roomId, selfId } = await createRoom(name)
        set({ roomId, selfId, busy: false })
        startSubs(roomId)
      } catch (err) {
        set({ busy: false, error: messageFor(err) })
      }
    },

    join: async (roomId, name) => {
      set({ busy: true, error: null, notice: null })
      try {
        const res = await joinRoom(roomId, name)
        set({ roomId: res.roomId, selfId: res.selfId, busy: false })
        startSubs(res.roomId)
      } catch (err) {
        set({ busy: false, error: messageFor(err) })
      }
    },

    leave: async () => {
      const { roomId, selfId } = get()
      const isHost = get().isHost()
      stopSubs() // 先停訂閱，避免房主刪房時 room=null 誤觸「被關閉」提示
      set({ ...initialState, selfId })
      if (roomId && selfId) {
        try {
          await leaveRoom(roomId, selfId, isHost)
        } catch {
          /* 離開失敗不阻斷 UI 返回；房間資料留待 TTL/重整清理 */
        }
      }
    },

    selectGame: async (gameType) => {
      const { roomId } = get()
      if (!roomId || !get().isHost()) return
      try {
        await setGameType(roomId, gameType)
      } catch (err) {
        set({ error: messageFor(err) })
      }
    },

    startGame: async () => {
      const { roomId } = get()
      if (!roomId || !get().isHost()) return
      try {
        await setRoomStatus(roomId, 'playing')
      } catch (err) {
        set({ error: messageFor(err) })
      }
    },

    clearError: () => set({ error: null }),

    reset: () => {
      stopSubs()
      set({ ...initialState, selfId: get().selfId })
    },
  }
})

export default useRoomStore
