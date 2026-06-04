import { create } from 'zustand'
import { sendToCandy, type CandyToReactMessage } from '@/lib/candyBridge'

interface CandyStore {
  isReady: boolean
  isPaused: boolean
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
  startLevel: (level: number) => void
  resetCandy: () => void
}

const initialState = {
  isReady: false,
  isPaused: false,
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

export const useCandyStore = create<CandyStore>((set) => ({
  ...initialState,

  handleCandyMessage: (msg) => {
    switch (msg.type) {
      case 'READY':
        set({ isReady: true })
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

  startLevel: (level) => {
    set({ isLevelEnd: false, won: false })
    sendToCandy({ type: 'START_LEVEL', payload: { level } })
  },

  resetCandy: () => set(initialState),
}))

export default useCandyStore
