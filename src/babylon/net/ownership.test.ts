import { describe, it, expect, vi, afterEach } from 'vitest'
import type { NetEvent, NetEventMap, NetTransport } from '@/core/webrtc'
import { createOwnershipSync } from './ownership'

afterEach(() => {
  vi.useRealTimers()
})

/** 假 NetTransport：記錄送出呼叫，並可手動觸發訂閱事件 */
const createFakeTransport = () => {
  const handlers: Partial<Record<NetEvent, Set<(...args: unknown[]) => void>>> = {}
  const transport: NetTransport = {
    send: vi.fn(),
    broadcast: vi.fn(),
    sendUnreliable: vi.fn(),
    broadcastUnreliable: vi.fn(),
    on: vi.fn(<E extends NetEvent>(event: E, cb: NetEventMap[E]) => {
      const set = (handlers[event] ??= new Set())
      set.add(cb as (...args: unknown[]) => void)
      return () => set.delete(cb as (...args: unknown[]) => void)
    }),
  }
  const emit = <E extends NetEvent>(event: E, ...args: Parameters<NetEventMap[E]>) => {
    handlers[event]?.forEach((cb) => cb(...args))
  }
  return { transport, emit }
}

describe('createOwnershipSync', () => {
  it('broadcasts its own state at the configured frequency with an incrementing seq', () => {
    vi.useFakeTimers()
    const { transport } = createFakeTransport()
    const sync = createOwnershipSync<{ x: number }>({ net: transport, game: 'race', hz: 10 })

    sync.start(() => ({ x: 5 }))
    vi.advanceTimersByTime(200)

    expect(transport.broadcastUnreliable).toHaveBeenCalledTimes(2)
    expect(transport.broadcastUnreliable).toHaveBeenNthCalledWith(1, {
      game: 'race',
      type: 'own',
      seq: 0,
      payload: { x: 5 },
    })
    expect(transport.broadcastUnreliable).toHaveBeenNthCalledWith(2, {
      game: 'race',
      type: 'own',
      seq: 1,
      payload: { x: 5 },
    })
  })

  it('records a remote peer state from matching "own" messages', () => {
    const { transport, emit } = createFakeTransport()
    const sync = createOwnershipSync<{ x: number }>({ net: transport, game: 'race' })

    emit('message', 'peerA', { game: 'race', type: 'own', seq: 1, payload: { x: 9 } })

    expect(sync.remoteIds()).toEqual(['peerA'])
    expect(sync.latestRemote('peerA')).toEqual({ x: 9 })
  })

  it('ignores messages for a different game or type', () => {
    const { transport, emit } = createFakeTransport()
    const sync = createOwnershipSync<{ x: number }>({ net: transport, game: 'race' })

    emit('message', 'peerA', { game: 'other', type: 'own', seq: 1, payload: { x: 1 } })
    emit('message', 'peerA', { game: 'race', type: 'snap', seq: 1, payload: { x: 1 } })

    expect(sync.remoteIds()).toEqual([])
  })

  it('removes the remote buffer when the peer leaves', () => {
    const { transport, emit } = createFakeTransport()
    const sync = createOwnershipSync<{ x: number }>({ net: transport, game: 'race' })

    emit('message', 'peerA', { game: 'race', type: 'own', seq: 1, payload: { x: 9 } })
    expect(sync.remoteIds()).toEqual(['peerA'])

    emit('peerLeave', 'peerA')

    expect(sync.remoteIds()).toEqual([])
    expect(sync.sampleRemote('peerA')).toBeNull()
    expect(sync.latestRemote('peerA')).toBeNull()
  })

  it('sampleRemote/latestRemote return null for an unknown peer', () => {
    const { transport } = createFakeTransport()
    const sync = createOwnershipSync<{ x: number }>({ net: transport, game: 'race' })
    expect(sync.sampleRemote('ghost')).toBeNull()
    expect(sync.latestRemote('ghost')).toBeNull()
  })

  it('stop() halts broadcasting, unsubscribes, and clears known remotes', () => {
    vi.useFakeTimers()
    const { transport, emit } = createFakeTransport()
    const sync = createOwnershipSync<{ x: number }>({ net: transport, game: 'race', hz: 10 })

    sync.start(() => ({ x: 1 }))
    emit('message', 'peerA', { game: 'race', type: 'own', seq: 1, payload: { x: 9 } })
    expect(sync.remoteIds()).toEqual(['peerA'])

    sync.stop()
    vi.advanceTimersByTime(500)
    // 廣播只發生在 stop 之前那一次 tick 窗口內（此處尚未經過任何 tick，故為 0 次）
    expect(transport.broadcastUnreliable).toHaveBeenCalledTimes(0)
    expect(sync.remoteIds()).toEqual([])

    // stop 後訊息訂閱應已取消，不再新增遠端
    emit('message', 'peerB', { game: 'race', type: 'own', seq: 1, payload: { x: 1 } })
    expect(sync.remoteIds()).toEqual([])
  })
})
