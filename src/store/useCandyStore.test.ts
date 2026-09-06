import { describe, it, expect, vi, beforeEach } from 'vitest'
import { sendToCandy } from '@/lib/candyBridge'
import { useCandyStore } from './useCandyStore'

vi.mock('@/lib/candyBridge', () => ({ sendToCandy: vi.fn() }))

const initialState = useCandyStore.getState()

describe('useCandyStore', () => {
  beforeEach(() => {
    localStorage.clear()
    useCandyStore.setState({ ...initialState, isMuted: false }, true)
  })

  it('handleCandyMessage(READY) marks ready and does not force mute when not muted', () => {
    useCandyStore.getState().handleCandyMessage({ type: 'READY', payload: { version: '1' } })
    expect(useCandyStore.getState().isReady).toBe(true)
    expect(sendToCandy).not.toHaveBeenCalled()
  })

  it('handleCandyMessage(READY) re-applies mute to the engine when isMuted is true', () => {
    useCandyStore.setState({ isMuted: true })
    useCandyStore.getState().handleCandyMessage({ type: 'READY', payload: { version: '1' } })
    expect(sendToCandy).toHaveBeenCalledWith({ type: 'SET_MUTED', payload: { muted: true } })
  })

  it('handleCandyMessage(STATE) updates level/score/moves/target/stars', () => {
    useCandyStore.getState().handleCandyMessage({
      type: 'STATE',
      payload: { level: 2, score: 100, moves: 5, target: 500, stars: 2 },
    })
    expect(useCandyStore.getState()).toMatchObject({ level: 2, score: 100, moves: 5, target: 500, stars: 2 })
  })

  it('handleCandyMessage(LEVEL_END) records the outcome', () => {
    useCandyStore.getState().handleCandyMessage({
      type: 'LEVEL_END',
      payload: { won: true, level: 2, score: 900, stars: 3 },
    })
    expect(useCandyStore.getState()).toMatchObject({
      isLevelEnd: true, won: true, endLevel: 2, endScore: 900, endStars: 3,
    })
  })

  it('setPaused updates local state and forwards SET_PAUSED', () => {
    useCandyStore.getState().setPaused(true)
    expect(useCandyStore.getState().isPaused).toBe(true)
    expect(sendToCandy).toHaveBeenCalledWith({ type: 'SET_PAUSED', payload: { paused: true } })
  })

  it('setMuted persists the preference to localStorage and forwards SET_MUTED', () => {
    useCandyStore.getState().setMuted(true)
    expect(useCandyStore.getState().isMuted).toBe(true)
    expect(localStorage.getItem('candy-muted')).toBe('1')
    expect(sendToCandy).toHaveBeenCalledWith({ type: 'SET_MUTED', payload: { muted: true } })

    useCandyStore.getState().setMuted(false)
    expect(localStorage.getItem('candy-muted')).toBe('0')
  })

  it('startLevel clears the end-of-level flags and forwards START_LEVEL', () => {
    useCandyStore.setState({ isLevelEnd: true, won: true })
    useCandyStore.getState().startLevel(4)
    expect(useCandyStore.getState()).toMatchObject({ isLevelEnd: false, won: false })
    expect(sendToCandy).toHaveBeenCalledWith({ type: 'START_LEVEL', payload: { level: 4 } })
  })

  it('resetCandy restores defaults but re-reads isMuted from localStorage rather than the stale snapshot', () => {
    localStorage.setItem('candy-muted', '1')
    useCandyStore.setState({ score: 999, level: 9, isMuted: false })

    useCandyStore.getState().resetCandy()

    expect(useCandyStore.getState()).toMatchObject({ score: 0, level: 1, isMuted: true })
  })
})
