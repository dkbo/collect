import { create } from 'zustand'
import React from 'react'

interface NpcChatState {
  isChat: boolean
  npcName: string
  npcMessage: React.ReactNode | string
  messageCount: number
}

interface RpgStore {
  // Scene State
  mapId: number
  isTransSence: boolean

  // Dialogue State
  isChat: boolean
  npcName: string
  npcMessage: React.ReactNode | string
  messageCount: number

  // Actions
  setTransSence: (isTransSence: boolean) => void
  setMap: (mapId: number, isTransSence: boolean) => void
  setNpcChat: (npc: Partial<NpcChatState>) => void
  closeChat: () => void
  resetRpg: () => void
}

export const useRpgStore = create<RpgStore>((set) => ({
  // Initial State
  mapId: 0,
  isTransSence: true,

  isChat: false,
  npcName: '',
  npcMessage: '',
  messageCount: 0,

  // Actions
  setTransSence: (isTransSence) => set({ isTransSence }),
  setMap: (mapId, isTransSence) => set({ mapId, isTransSence }),
  setNpcChat: (npc) => set((state) => ({ ...state, ...npc })),
  closeChat: () => set({ isChat: false, messageCount: 0, npcName: '', npcMessage: '' }),
  resetRpg: () => set({
    mapId: 0,
    isTransSence: true,
    isChat: false,
    npcName: '',
    npcMessage: '',
    messageCount: 0,
  }),
}))

export default useRpgStore
