import { describe, it, expect, vi, afterEach } from 'vitest'
import type { NetEvent, NetEventMap, NetTransport } from '@/core/webrtc'
import { canAdvanceMidRound, createGameFlow } from './gameFlow'

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
    const flow = createGameFlow({ net: transport, game: 'g', role: 'host', hostId: 'host' })

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
    const flow = createGameFlow({ net: transport, game: 'g', role: 'host', hostId: 'host' })

    flow.endGame({ score: 42 })
    expect(flow.state).toEqual({ phase: 'result', result: { score: 42 } })

    flow.reset()
    expect(flow.state).toEqual({ phase: 'lobby' })
    expect(transport.broadcast).toHaveBeenNthCalledWith(2, { game: 'g', type: 'flow', payload: { phase: 'lobby' } })
  })

  it('onChange fires on each transition and stops after unsubscribing', () => {
    vi.useFakeTimers()
    const { transport } = createFakeTransport()
    const flow = createGameFlow({ net: transport, game: 'g', role: 'host', hostId: 'host' })
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
    const flow = createGameFlow({ net: transport, game: 'g', role: 'host', hostId: 'host' })

    emit('message', 'someone', { game: 'g', type: 'flow', payload: { phase: 'result', result: { score: 1 } } })

    expect(flow.state).toEqual({ phase: 'lobby' })
  })

  it('open: sends the current phase (with remaining countdown) to a newly-opened peer, but nothing while lobby', () => {
    vi.useFakeTimers()
    const { transport, emit } = createFakeTransport()
    const flow = createGameFlow({ net: transport, game: 'g', role: 'host', hostId: 'host' })

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
    const flow = createGameFlow({ net: transport, game: 'g', role: 'host', hostId: 'host' })

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
    const flow = createGameFlow({ net: transport, game: 'g', role: 'guest', hostId: 'host' })

    emit('message', 'host', { game: 'g', type: 'flow', payload: { phase: 'countdown', durationMs: 500 } })
    expect(flow.state.phase).toBe('countdown')
    expect(flow.countdownRemaining()).toBe(500)

    vi.advanceTimersByTime(500)

    expect(flow.state.phase).toBe('playing')
    expect(transport.broadcast).not.toHaveBeenCalled()
  })

  it('host-only operations (startCountdown/endGame/reset) are no-ops for a guest', () => {
    const { transport } = createFakeTransport()
    const flow = createGameFlow({ net: transport, game: 'g', role: 'guest', hostId: 'host' })

    flow.startCountdown(1)
    flow.endGame({ score: 1 })
    flow.reset()

    expect(transport.broadcast).not.toHaveBeenCalled()
    expect(flow.state).toEqual({ phase: 'lobby' })
  })

  it('ignores flow messages that do not come from the host (C1 host authority)', () => {
    const { transport, emit } = createFakeTransport()
    const flow = createGameFlow({ net: transport, game: 'g', role: 'guest', hostId: 'host' })

    emit('message', 'attacker', { game: 'g', type: 'flow', payload: { phase: 'result', result: { hacked: true } } })

    expect(flow.state).toEqual({ phase: 'lobby' })
  })

  it('drops malformed flow payloads (unknown phase / absurd countdown / non-object)', () => {
    vi.useFakeTimers()
    const { transport, emit } = createFakeTransport()
    const flow = createGameFlow({ net: transport, game: 'g', role: 'guest', hostId: 'host' })

    emit('message', 'host', { game: 'g', type: 'flow', payload: undefined })
    emit('message', 'host', { game: 'g', type: 'flow', payload: { phase: 'pwned' } })
    emit('message', 'host', { game: 'g', type: 'flow', payload: { phase: 'countdown', durationMs: Number.NaN } })
    emit('message', 'host', { game: 'g', type: 'flow', payload: { phase: 'countdown', durationMs: 1e12 } })

    expect(flow.state).toEqual({ phase: 'lobby' })
  })

  it('drops a result payload that is not structured data, and ignores result outside the result phase', () => {
    const { transport, emit } = createFakeTransport()
    const flow = createGameFlow({ net: transport, game: 'g', role: 'guest', hostId: 'host' })

    // result 階段但 result 是純量 → 整則丟棄
    emit('message', 'host', { game: 'g', type: 'flow', payload: { phase: 'result', result: 'pwned' } })
    expect(flow.state).toEqual({ phase: 'lobby' })

    // 非 result 階段夾帶的 result 一律忽略
    emit('message', 'host', { game: 'g', type: 'flow', payload: { phase: 'playing', result: { x: 1 } } })
    expect(flow.state).toEqual({ phase: 'playing', result: undefined })

    // 合法結算資料照常套用
    emit('message', 'host', { game: 'g', type: 'flow', payload: { phase: 'result', result: [{ id: 'a' }] } })
    expect(flow.state).toEqual({ phase: 'result', result: [{ id: 'a' }] })
  })

  it('ignores messages for a different game or a non-flow type', () => {
    const { transport, emit } = createFakeTransport()
    const flow = createGameFlow({ net: transport, game: 'g', role: 'guest', hostId: 'host' })

    emit('message', 'host', { game: 'other', type: 'flow', payload: { phase: 'playing' } })
    emit('message', 'host', { game: 'g', type: 'own', payload: { phase: 'playing' } })

    expect(flow.state).toEqual({ phase: 'lobby' })
  })

  it('dispose() unsubscribes so later messages no longer update state', () => {
    const { transport, emit } = createFakeTransport()
    const flow = createGameFlow({ net: transport, game: 'g', role: 'guest', hostId: 'host' })
    const cb = vi.fn()
    flow.onChange(cb)

    flow.dispose()
    emit('message', 'host', { game: 'g', type: 'flow', payload: { phase: 'countdown', durationMs: 500 } })

    expect(cb).not.toHaveBeenCalled()
    expect(flow.state).toEqual({ phase: 'lobby' })
  })
})

/**
 * 重開/推進回合的受理規則（bomber 與 tank 的 host restartReq 與客端 canRestart 共用）。
 * 目的：保留「死了不想等 bot 打完」，但不讓陣亡者切掉還活著的人的回合。
 */
describe('canAdvanceMidRound', () => {
  const alive = (ids: string[]) => (id: string) => ids.includes(id)

  it('result 階段任何玩家都能推進（含仍存活者）', () => {
    expect(canAdvanceMidRound('result', ['p1', 'p2'], alive(['p1']), 'p1')).toBe(true)
    expect(canAdvanceMidRound('result', ['p1', 'p2'], alive(['p1']), 'p2')).toBe(true)
  })

  it('playing 且還有真人活著 → 陣亡者不能跳過', () => {
    expect(canAdvanceMidRound('playing', ['p1', 'p2'], alive(['p1']), 'p2')).toBe(false)
  })

  it('playing 且真人全滅（只剩 bot 在打）→ 陣亡者可跳過', () => {
    expect(canAdvanceMidRound('playing', ['p1', 'p2'], alive([]), 'p2')).toBe(true)
  })

  it('playing 且請求者自己還活著 → 不受理', () => {
    expect(canAdvanceMidRound('playing', ['p1', 'p2'], alive(['p1', 'p2']), 'p1')).toBe(false)
    // 連自己都還活著時，即使其他人全死也不受理
    expect(canAdvanceMidRound('playing', ['p1', 'p2'], alive(['p1']), 'p1')).toBe(false)
  })

  it('單人局：自己陣亡（場上只剩 bot）即可重開', () => {
    expect(canAdvanceMidRound('playing', ['p1'], alive([]), 'p1')).toBe(true)
  })
})
