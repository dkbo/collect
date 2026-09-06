import { describe, it, expect, vi, afterEach } from 'vitest'
import type { NetEvent, NetEventMap, NetTransport } from '@/core/webrtc'
import { createGameFlow } from './gameFlow'

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

describe('createGameFlow (host)', () => {
  it('runs lobby -> countdown -> playing, broadcasting each transition', () => {
    vi.useFakeTimers()
    const { transport } = createFakeTransport()
    const flow = createGameFlow({ net: transport, game: 'g', role: 'host' })

    flow.startCountdown(1)
    expect(transport.broadcast).toHaveBeenNthCalledWith(1, {
      game: 'g',
      type: 'flow',
      payload: { phase: 'countdown', durationMs: 1000 },
    })
    expect(flow.state.phase).toBe('countdown')
    expect(flow.countdownRemaining()).toBe(1000)

    vi.advanceTimersByTime(1000)

    expect(transport.broadcast).toHaveBeenNthCalledWith(2, {
      game: 'g',
      type: 'flow',
      payload: { phase: 'playing' },
    })
    expect(flow.state.phase).toBe('playing')
    expect(flow.countdownRemaining()).toBe(0)
  })

  it('endGame() and reset() broadcast result/lobby transitions', () => {
    const { transport } = createFakeTransport()
    const flow = createGameFlow({ net: transport, game: 'g', role: 'host' })

    flow.endGame({ score: 42 })
    expect(flow.state).toEqual({ phase: 'result', result: { score: 42 } })

    flow.reset()
    expect(flow.state).toEqual({ phase: 'lobby' })
    expect(transport.broadcast).toHaveBeenNthCalledWith(2, { game: 'g', type: 'flow', payload: { phase: 'lobby' } })
  })

  it('onChange fires on each transition and stops after unsubscribing', () => {
    vi.useFakeTimers()
    const { transport } = createFakeTransport()
    const flow = createGameFlow({ net: transport, game: 'g', role: 'host' })
    const cb = vi.fn()
    const off = flow.onChange(cb)

    flow.startCountdown(1)
    expect(cb).toHaveBeenCalledTimes(1)

    off()
    vi.advanceTimersByTime(1000) // 觸發 countdown -> playing
    expect(cb).toHaveBeenCalledTimes(1) // 取消訂閱後不再收到
  })

  it('ignores incoming flow messages (host is the sole authority)', () => {
    const { transport, emit } = createFakeTransport()
    const flow = createGameFlow({ net: transport, game: 'g', role: 'host' })

    emit('message', 'someone', { game: 'g', type: 'flow', payload: { phase: 'result', result: { score: 1 } } })

    expect(flow.state).toEqual({ phase: 'lobby' })
  })

  it('open: sends the current phase (with remaining countdown) to a newly-opened peer, but nothing while lobby', () => {
    vi.useFakeTimers()
    const { transport, emit } = createFakeTransport()
    const flow = createGameFlow({ net: transport, game: 'g', role: 'host' })

    emit('open', 'peerA')
    expect(transport.send).not.toHaveBeenCalled()

    flow.startCountdown(2) // 2000ms
    vi.advanceTimersByTime(500) // 1500ms 剩餘
    emit('open', 'peerB')
    expect(transport.send).toHaveBeenCalledWith('peerB', {
      game: 'g',
      type: 'flow',
      payload: { phase: 'countdown', durationMs: 1500 },
    })

    vi.advanceTimersByTime(1500) // 進 playing
    emit('open', 'peerC')
    expect(transport.send).toHaveBeenLastCalledWith('peerC', {
      game: 'g',
      type: 'flow',
      payload: { phase: 'playing' },
    })
  })

  it('dispose() clears the pending countdown timer so it never fires', () => {
    vi.useFakeTimers()
    const { transport } = createFakeTransport()
    const flow = createGameFlow({ net: transport, game: 'g', role: 'host' })

    flow.startCountdown(1)
    expect(transport.broadcast).toHaveBeenCalledTimes(1)

    flow.dispose()
    vi.advanceTimersByTime(1000)

    expect(transport.broadcast).toHaveBeenCalledTimes(1) // 沒有多送出 playing 轉場
  })
})

describe('createGameFlow (guest)', () => {
  it('applies an incoming countdown message and locally advances to playing without broadcasting', () => {
    vi.useFakeTimers()
    const { transport, emit } = createFakeTransport()
    const flow = createGameFlow({ net: transport, game: 'g', role: 'guest' })

    emit('message', 'host', { game: 'g', type: 'flow', payload: { phase: 'countdown', durationMs: 500 } })
    expect(flow.state.phase).toBe('countdown')
    expect(flow.countdownRemaining()).toBe(500)

    vi.advanceTimersByTime(500)

    expect(flow.state.phase).toBe('playing')
    expect(transport.broadcast).not.toHaveBeenCalled()
  })

  it('host-only operations (startCountdown/endGame/reset) are no-ops for a guest', () => {
    const { transport } = createFakeTransport()
    const flow = createGameFlow({ net: transport, game: 'g', role: 'guest' })

    flow.startCountdown(1)
    flow.endGame({ score: 1 })
    flow.reset()

    expect(transport.broadcast).not.toHaveBeenCalled()
    expect(flow.state).toEqual({ phase: 'lobby' })
  })

  it('ignores messages for a different game or a non-flow type', () => {
    const { transport, emit } = createFakeTransport()
    const flow = createGameFlow({ net: transport, game: 'g', role: 'guest' })

    emit('message', 'host', { game: 'other', type: 'flow', payload: { phase: 'playing' } })
    emit('message', 'host', { game: 'g', type: 'own', payload: { phase: 'playing' } })

    expect(flow.state).toEqual({ phase: 'lobby' })
  })

  it('dispose() unsubscribes so later messages no longer update state', () => {
    const { transport, emit } = createFakeTransport()
    const flow = createGameFlow({ net: transport, game: 'g', role: 'guest' })
    const cb = vi.fn()
    flow.onChange(cb)

    flow.dispose()
    emit('message', 'host', { game: 'g', type: 'flow', payload: { phase: 'countdown', durationMs: 500 } })

    expect(cb).not.toHaveBeenCalled()
    expect(flow.state).toEqual({ phase: 'lobby' })
  })
})
