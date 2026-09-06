import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import type { NetEvent, NetEventMap } from '@/core/webrtc'
import { createMesh } from '@/core/webrtc'
import { useNetStore } from './useNetStore'

vi.mock('@/core/webrtc', () => ({ createMesh: vi.fn() }))

/** 假 Mesh：記錄 send/broadcast 呼叫，並可手動觸發訂閱事件 */
const createFakeMesh = () => {
  const handlers: Partial<Record<NetEvent, Set<(...args: unknown[]) => void>>> = {}
  const mesh = {
    send: vi.fn(),
    broadcast: vi.fn(),
    sendUnreliable: vi.fn(),
    broadcastUnreliable: vi.fn(),
    on: vi.fn(<E extends NetEvent>(event: E, cb: NetEventMap[E]) => {
      const set = (handlers[event] ??= new Set())
      set.add(cb as (...args: unknown[]) => void)
      return () => set.delete(cb as (...args: unknown[]) => void)
    }),
    start: vi.fn(),
    stop: vi.fn(),
    updatePeers: vi.fn(),
  }
  const emit = <E extends NetEvent>(event: E, ...args: Parameters<NetEventMap[E]>) => {
    handlers[event]?.forEach((cb) => cb(...args))
  }
  return { mesh, emit }
}

describe('useNetStore', () => {
  beforeEach(() => {
    // 模組層級的 mesh/unsubs 只能靠 disconnect() 收斂；先清掉前一個測試殘留的連線
    useNetStore.getState().disconnect()
  })

  it('connect() with a single peer goes straight to "connected" and starts the mesh', () => {
    const { mesh } = createFakeMesh()
    vi.mocked(createMesh).mockReturnValue(mesh)

    useNetStore.getState().connect('room1', 'self', ['self'])

    expect(createMesh).toHaveBeenCalledWith({ roomId: 'room1', selfId: 'self', peerIds: ['self'] })
    expect(mesh.start).toHaveBeenCalledTimes(1)
    expect(useNetStore.getState().status).toBe('connected')
    expect(useNetStore.getState().transport).toBe(mesh)
  })

  it('connect() with multiple peers starts as "connecting" until a peer opens', () => {
    const { mesh, emit } = createFakeMesh()
    vi.mocked(createMesh).mockReturnValue(mesh)

    useNetStore.getState().connect('room1', 'self', ['self', 'peerA'])
    expect(useNetStore.getState().status).toBe('connecting')

    emit('open', 'peerA')
    expect(useNetStore.getState().status).toBe('connected')
    expect(useNetStore.getState().openPeers).toEqual(['peerA'])
    expect(useNetStore.getState().log[0].text).toContain('已連線')
  })

  it('does not add duplicate entries when the same peer opens twice', () => {
    const { mesh, emit } = createFakeMesh()
    vi.mocked(createMesh).mockReturnValue(mesh)
    useNetStore.getState().connect('room1', 'self', ['self', 'peerA'])

    emit('open', 'peerA')
    emit('open', 'peerA')

    expect(useNetStore.getState().openPeers).toEqual(['peerA'])
  })

  it('"close" event removes the peer from openPeers', () => {
    const { mesh, emit } = createFakeMesh()
    vi.mocked(createMesh).mockReturnValue(mesh)
    useNetStore.getState().connect('room1', 'self', ['self', 'peerA'])
    emit('open', 'peerA')

    emit('close', 'peerA')

    expect(useNetStore.getState().openPeers).toEqual([])
  })

  it('replies to a "_sys" ping message with a pong addressed to the sender', () => {
    const { mesh, emit } = createFakeMesh()
    vi.mocked(createMesh).mockReturnValue(mesh)
    useNetStore.getState().connect('room1', 'self', ['self', 'peerA'])

    emit('message', 'peerA', { game: '_sys', type: 'ping', payload: { from: 'peerA', t: 123 } })

    expect(mesh.send).toHaveBeenCalledWith('peerA', {
      game: '_sys',
      type: 'pong',
      payload: { from: 'self', t: 123 },
    })
  })

  it('logs the RTT when a "_sys" pong message arrives', () => {
    const { mesh, emit } = createFakeMesh()
    vi.mocked(createMesh).mockReturnValue(mesh)
    useNetStore.getState().connect('room1', 'self', ['self', 'peerA'])

    emit('message', 'peerA', { game: '_sys', type: 'pong', payload: { from: 'peerA', t: Date.now() } })

    expect(useNetStore.getState().log[0].text).toContain('pong')
    expect(mesh.send).not.toHaveBeenCalled()
  })

  it('ignores messages outside the "_sys" namespace', () => {
    const { mesh, emit } = createFakeMesh()
    vi.mocked(createMesh).mockReturnValue(mesh)
    useNetStore.getState().connect('room1', 'self', ['self', 'peerA'])

    emit('message', 'peerA', { game: 'race', type: 'ping', payload: { from: 'peerA', t: 1 } })

    expect(mesh.send).not.toHaveBeenCalled()
    expect(useNetStore.getState().log).toEqual([])
  })

  it('ping() broadcasts to all peers and logs the outgoing ping', () => {
    const { mesh } = createFakeMesh()
    vi.mocked(createMesh).mockReturnValue(mesh)
    useNetStore.getState().connect('room1', 'self', ['self', 'peerA'])

    useNetStore.getState().ping()

    expect(mesh.broadcast).toHaveBeenCalledWith({ game: '_sys', type: 'ping', payload: { from: 'self', t: expect.any(Number) } })
    expect(useNetStore.getState().log[0].text).toBe('ping → 全體')
  })

  it('ping() is a no-op when there is no active mesh', () => {
    expect(() => useNetStore.getState().ping()).not.toThrow()
    expect(useNetStore.getState().log).toEqual([])
  })

  it('disconnect() stops the mesh, unsubscribes, and resets state to idle', () => {
    const { mesh, emit } = createFakeMesh()
    vi.mocked(createMesh).mockReturnValue(mesh)
    useNetStore.getState().connect('room1', 'self', ['self', 'peerA'])
    emit('open', 'peerA')

    useNetStore.getState().disconnect()

    expect(mesh.stop).toHaveBeenCalledTimes(1)
    expect(useNetStore.getState()).toMatchObject({ status: 'idle', openPeers: [], transport: null, log: [] })

    // 訂閱已取消：斷線後再 emit 不應影響狀態
    emit('open', 'peerA')
    expect(useNetStore.getState().openPeers).toEqual([])
  })

  it('disconnect() clears self so a later connect() with a new uid replies to ping with the new id', () => {
    const first = createFakeMesh()
    vi.mocked(createMesh).mockReturnValue(first.mesh)
    useNetStore.getState().connect('room1', 'selfA', ['selfA', 'peerA'])
    useNetStore.getState().disconnect()

    const second = createFakeMesh()
    vi.mocked(createMesh).mockReturnValue(second.mesh)
    useNetStore.getState().connect('room1', 'selfB', ['selfB', 'peerA'])

    second.emit('message', 'peerA', { game: '_sys', type: 'ping', payload: { from: 'peerA', t: 99 } })

    expect(second.mesh.send).toHaveBeenCalledWith('peerA', {
      game: '_sys',
      type: 'pong',
      payload: { from: 'selfB', t: 99 },
    })
    // 第一個 mesh 早已 teardown，不該再收到任何呼叫
    expect(first.mesh.send).not.toHaveBeenCalled()
  })

  it('does not share the same openPeers/log array instance across connect() calls', () => {
    const first = createFakeMesh()
    vi.mocked(createMesh).mockReturnValue(first.mesh)
    useNetStore.getState().connect('room1', 'self', ['self', 'peerA'])
    const firstOpenPeers = useNetStore.getState().openPeers
    const firstLog = useNetStore.getState().log

    useNetStore.getState().disconnect()

    const second = createFakeMesh()
    vi.mocked(createMesh).mockReturnValue(second.mesh)
    useNetStore.getState().connect('room1', 'self', ['self', 'peerA'])

    expect(useNetStore.getState().openPeers).not.toBe(firstOpenPeers)
    expect(useNetStore.getState().log).not.toBe(firstLog)
  })

  it('syncPeers() forwards the id list to mesh.updatePeers', () => {
    const { mesh } = createFakeMesh()
    vi.mocked(createMesh).mockReturnValue(mesh)
    useNetStore.getState().connect('room1', 'self', ['self', 'peerA'])

    useNetStore.getState().syncPeers(['peerA', 'peerB'])

    expect(mesh.updatePeers).toHaveBeenCalledWith(['peerA', 'peerB'])
  })

  it('syncPeers() is a no-op when there is no active mesh', () => {
    expect(() => useNetStore.getState().syncPeers(['peerA'])).not.toThrow()
  })

  describe('connect timeout', () => {
    beforeEach(() => {
      vi.useFakeTimers()
    })

    afterEach(() => {
      vi.useRealTimers()
    })

    it('sets connectTimedOut after 15s when a multi-peer connect never reaches "connected"', () => {
      const { mesh } = createFakeMesh()
      vi.mocked(createMesh).mockReturnValue(mesh)

      useNetStore.getState().connect('room1', 'self', ['self', 'peerA'])
      expect(useNetStore.getState().connectTimedOut).toBe(false)

      vi.advanceTimersByTime(15_000)

      expect(useNetStore.getState().connectTimedOut).toBe(true)
    })

    it('does not set connectTimedOut when the peer opens before the timeout', () => {
      const { mesh, emit } = createFakeMesh()
      vi.mocked(createMesh).mockReturnValue(mesh)

      useNetStore.getState().connect('room1', 'self', ['self', 'peerA'])
      emit('open', 'peerA')

      vi.advanceTimersByTime(15_000)

      expect(useNetStore.getState().connectTimedOut).toBe(false)
    })

    it('disconnect() clears the pending timer and connectTimedOut flag', () => {
      const { mesh } = createFakeMesh()
      vi.mocked(createMesh).mockReturnValue(mesh)

      useNetStore.getState().connect('room1', 'self', ['self', 'peerA'])
      useNetStore.getState().disconnect()

      vi.advanceTimersByTime(15_000)

      expect(useNetStore.getState().connectTimedOut).toBe(false)
    })
  })
})
