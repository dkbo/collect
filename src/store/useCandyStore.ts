import { create } from 'zustand'
import { sendToCandy, type CandyToReactMessage } from '@/lib/candyBridge'

/** 靜音偏好持久化 key */
const MUTED_KEY = 'candy-muted'

interface CandyStore {
  isReady: boolean
  isPaused: boolean
  isMuted: boolean
  level: number
  score: number
  moves: number
  target: number
  stars: number
  isLevelEnd: boolean
  won: boolean
  endLevel: number
  endScore: number
  endStars: number

  handleCandyMessage: (msg: CandyToReactMessage) => void
  setPaused: (paused: boolean) => void
  setMuted: (muted: boolean) => void
  startLevel: (level: number) => void
  resetCandy: () => void
}

const initialState = {
  isReady: false,
  isPaused: false,
  isMuted: localStorage.getItem(MUTED_KEY) === '1',
  level: 1,
  score: 0,
  moves: 0,
  target: 0,
  stars: 0,
  isLevelEnd: false,
  won: false,
  endLevel: 0,
  endScore: 0,
  endStars: 0,
}

export const useCandyStore = create<CandyStore>((set, get) => ({
  ...initialState,

  handleCandyMessage: (msg) => {
    switch (msg.type) {
      case 'READY':
        set({ isReady: true })
        if (get().isMuted) sendToCandy({ type: 'SET_MUTED', payload: { muted: true } })
        break
      case 'STATE':
        set({
          level: msg.payload.level,
          score: msg.payload.score,
          moves: msg.payload.moves,
          target: msg.payload.target,
          stars: msg.payload.stars,
        })
        break
      case 'LEVEL_END':
        set({
          isLevelEnd: true,
          won: msg.payload.won,
          endLevel: msg.payload.level,
          endScore: msg.payload.score,
          endStars: msg.payload.stars,
        })
        break
    }
  },

  setPaused: (paused) => {
    set({ isPaused: paused })
    sendToCandy({ type: 'SET_PAUSED', payload: { paused } })
  },

  setMuted: (muted) => {
    set({ isMuted: muted })
    localStorage.setItem(MUTED_KEY, muted ? '1' : '0')
    sendToCandy({ type: 'SET_MUTED', payload: { muted } })
  },

  startLevel: (level) => {
    set({ isLevelEnd: false, won: false })
    sendToCandy({ type: 'START_LEVEL', payload: { level } })
  },

  // 靜音為持久化偏好，重置時依 localStorage 還原而非模組載入時的快照
  resetCandy: () => set({ ...initialState, isMuted: localStorage.getItem(MUTED_KEY) === '1' }),
}))

export default useCandyStore
