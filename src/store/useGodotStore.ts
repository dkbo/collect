import { create } from 'zustand'
import { sendToGodot, type GodotToReactMessage } from '@/lib/godotBridge'

interface GodotStore {
  // Engine State
  isReady: boolean
  mapId: number
  mapName: string
  playerX: number
  playerY: number
  isPaused: boolean

  // Dialogue State（text 為原始 markup 字串，渲染交給元件層 renderMessage）
  isChat: boolean
  npcName: string
  npcText: string
  chatPage: number
  chatTotal: number

  // Actions
  handleGodotMessage: (msg: GodotToReactMessage) => void
  setPaused: (paused: boolean) => void
  resetGodot: () => void
}

const initialState = {
  isReady: false,
  mapId: 0,
  mapName: '',
  playerX: 0,
  playerY: 0,
  isPaused: false,
  isChat: false,
  npcName: '',
  npcText: '',
  chatPage: 0,
  chatTotal: 0,
}

export const useGodotStore = create<GodotStore>((set) => ({
  ...initialState,

  // 統一接收 Godot 事件（GodotFrame 訂閱 onGodotMessage 後轉發至此）
  handleGodotMessage: (msg) => {
    switch (msg.type) {
      case 'READY':
        set({ isReady: true })
        break
      case 'MAP_CHANGED':
        set({ mapId: msg.payload.mapId, mapName: msg.payload.name })
        break
      case 'PLAYER_POS':
        set({ playerX: msg.payload.x, playerY: msg.payload.y })
        break
      case 'NPC_CHAT':
        set({
          isChat: true,
          npcName: msg.payload.name,
          npcText: msg.payload.text,
          chatPage: msg.payload.page,
          chatTotal: msg.payload.total,
        })
        break
      case 'CHAT_CLOSED':
        set({ isChat: false, npcName: '', npcText: '', chatPage: 0, chatTotal: 0 })
        break
    }
  },

  setPaused: (paused) => {
    set({ isPaused: paused })
    sendToGodot({ type: 'SET_PAUSED', payload: { paused } })
  },

  resetGodot: () => set(initialState),
}))

export default useGodotStore
