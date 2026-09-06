import { describe, it, expect, vi, beforeEach } from 'vitest'
import { sendToGodot } from '@/lib/godotBridge'
import { useGodotStore } from './useGodotStore'

vi.mock('@/lib/godotBridge', () => ({ sendToGodot: vi.fn() }))

const initialState = useGodotStore.getState()

describe('useGodotStore', () => {
  beforeEach(() => {
    useGodotStore.setState(initialState, true)
  })

  it('handleGodotMessage(READY) marks the engine as ready', () => {
    useGodotStore.getState().handleGodotMessage({ type: 'READY', payload: { version: '1' } })
    expect(useGodotStore.getState().isReady).toBe(true)
  })

  it('handleGodotMessage(MAP_CHANGED) updates mapId/mapName', () => {
    useGodotStore.getState().handleGodotMessage({ type: 'MAP_CHANGED', payload: { mapId: 3, name: '村莊' } })
    expect(useGodotStore.getState()).toMatchObject({ mapId: 3, mapName: '村莊' })
  })

  it('handleGodotMessage(PLAYER_POS) updates player coordinates', () => {
    useGodotStore.getState().handleGodotMessage({ type: 'PLAYER_POS', payload: { x: 10, y: 20 } })
    expect(useGodotStore.getState()).toMatchObject({ playerX: 10, playerY: 20 })
  })

  it('handleGodotMessage(NPC_CHAT) opens the dialogue with npc/text/page state', () => {
    useGodotStore.getState().handleGodotMessage({
      type: 'NPC_CHAT',
      payload: { name: '村長', text: '你好', page: 1, total: 3 },
    })
    expect(useGodotStore.getState()).toMatchObject({
      isChat: true, npcName: '村長', npcText: '你好', chatPage: 1, chatTotal: 3,
    })
  })

  it('handleGodotMessage(CHAT_CLOSED) clears dialogue state', () => {
    useGodotStore.setState({ isChat: true, npcName: '村長', npcText: 'hi', chatPage: 1, chatTotal: 2 })
    useGodotStore.getState().handleGodotMessage({ type: 'CHAT_CLOSED' })
    expect(useGodotStore.getState()).toMatchObject({ isChat: false, npcName: '', npcText: '', chatPage: 0, chatTotal: 0 })
  })

  it('setPaused updates local state and forwards SET_PAUSED to Godot', () => {
    useGodotStore.getState().setPaused(true)
    expect(useGodotStore.getState().isPaused).toBe(true)
    expect(sendToGodot).toHaveBeenCalledWith({ type: 'SET_PAUSED', payload: { paused: true } })
  })

  it('resetGodot restores every field to its initial value', () => {
    useGodotStore.setState({ isReady: true, mapId: 5, isChat: true, npcName: 'x' })
    useGodotStore.getState().resetGodot()
    expect(useGodotStore.getState()).toMatchObject(initialState)
  })
})
