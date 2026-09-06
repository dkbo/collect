import { describe, it, expect, beforeEach } from 'vitest'
import { useRpgStore } from './useRpgStore'

const initialState = useRpgStore.getState()

describe('useRpgStore', () => {
  beforeEach(() => {
    useRpgStore.setState(initialState, true)
  })

  it('setTransSence toggles the transition flag only', () => {
    useRpgStore.getState().setTransSence(false)
    expect(useRpgStore.getState().isTransSence).toBe(false)
  })

  it('setMap updates both mapId and the transition flag', () => {
    useRpgStore.getState().setMap(4, false)
    expect(useRpgStore.getState()).toMatchObject({ mapId: 4, isTransSence: false })
  })

  it('setNpcChat merges only the provided fields, leaving the rest untouched', () => {
    useRpgStore.setState({ isChat: true, npcName: 'A', npcMessage: 'hi', messageCount: 1 })
    useRpgStore.getState().setNpcChat({ npcMessage: 'updated' })

    expect(useRpgStore.getState()).toMatchObject({
      isChat: true, npcName: 'A', npcMessage: 'updated', messageCount: 1,
    })
  })

  it('closeChat clears dialogue state but leaves mapId untouched', () => {
    useRpgStore.setState({ mapId: 2, isChat: true, npcName: 'A', npcMessage: 'hi', messageCount: 3 })
    useRpgStore.getState().closeChat()

    expect(useRpgStore.getState()).toMatchObject({
      mapId: 2, isChat: false, npcName: '', npcMessage: '', messageCount: 0,
    })
  })

  it('resetRpg restores every field to its initial value', () => {
    useRpgStore.setState({ mapId: 5, isTransSence: false, isChat: true, npcName: 'A', npcMessage: 'hi', messageCount: 2 })
    useRpgStore.getState().resetRpg()

    expect(useRpgStore.getState()).toMatchObject({
      mapId: 0, isTransSence: true, isChat: false, npcName: '', npcMessage: '', messageCount: 0,
    })
  })
})
