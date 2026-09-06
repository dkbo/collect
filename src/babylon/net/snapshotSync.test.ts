import { describe, it, expect, vi, afterEach } from 'vitest'
import type { GameNetMessage, NetEvent, NetEventMap, NetTransport } from '@/core/webrtc'
import { createHostSnapshot, createSnapshotBuffer, createSnapshotReceiver } from './snapshotSync'

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

describe('createSnapshotBuffer', () => {
  it('interpolates between two pushed samples at the delayed playback point', () => {
    vi.useFakeTimers()
    const buf = createSnapshotBuffer<number>(100)

    buf.push(1, 0) // t=0
    vi.advanceTimersByTime(100)
    buf.push(2, 100) // t=100
    vi.advanceTimersByTime(50) // now t=150 → target = 150-100 = 50

    const pair = buf.sample()
    expect(pair).not.toBeNull()
    expect(pair).toEqual({ a: 0, b: 100, alpha: 0.5 })
  })

  it('returns null when the buffer is empty', () => {
    const buf = createSnapshotBuffer<number>(100)
    expect(buf.sample()).toBeNull()
    expect(buf.latest()).toBeNull()
  })

  it('drops samples whose seq is not newer than the last accepted one', () => {
    const buf = createSnapshotBuffer<number>(100)
    buf.push(5, 500)
    buf.push(3, 300) // 舊包，應被忽略
    buf.push(5, 999) // 同 seq，應被忽略
    expect(buf.latest()).toBe(500)
  })

  it('tracks seq per sender, so one peer cannot poison another sender stream', () => {
    const buf = createSnapshotBuffer<number>(100)
    buf.push(999999, 1, 'attacker') // 攻擊者送出超大 seq
    buf.push(1, 42, 'host') // host 的正常 seq 仍須被接受
    expect(buf.latest()).toBe(42)
    buf.push(2, 43, 'host')
    expect(buf.latest()).toBe(43)
  })

  it('rejects a non-finite seq', () => {
    const buf = createSnapshotBuffer<number>(100)
    buf.push(Number.NaN, 7)
    expect(buf.latest()).toBeNull()
  })

  it('clamps to the newest sample once the playback point catches up to it', () => {
    vi.useFakeTimers()
    const buf = createSnapshotBuffer<number>(100)
    buf.push(1, 42) // t=0，唯一一筆
    vi.advanceTimersByTime(500) // now=500，delay=100 → target=400 > 0（唯一樣本）
    expect(buf.sample()).toEqual({ a: 42, b: 42, alpha: 0 })
  })

  it('clear() resets state so an old seq can be accepted again', () => {
    const buf = createSnapshotBuffer<number>(100)
    buf.push(5, 500)
    buf.clear()
    expect(buf.latest()).toBeNull()
    expect(buf.sample()).toBeNull()
    buf.push(0, 1) // clear 前會被視為舊包，clear 後應可接受
    expect(buf.latest()).toBe(1)
  })
})

describe('createHostSnapshot', () => {
  it('broadcasts the current state at the configured frequency with an incrementing seq', () => {
    vi.useFakeTimers()
    const { transport } = createFakeTransport()
    let state = { x: 0 }
    const sender = createHostSnapshot({ net: transport, game: 'g1', getState: () => state, hz: 10 })

    sender.start()
    state = { x: 1 }
    vi.advanceTimersByTime(200) // 2 個 100ms tick

    expect(transport.broadcastUnreliable).toHaveBeenCalledTimes(2)
    expect(transport.broadcastUnreliable).toHaveBeenNthCalledWith(1, {
      game: 'g1',
      type: 'snap',
      seq: 0,
      payload: { x: 1 },
    })
    expect(transport.broadcastUnreliable).toHaveBeenNthCalledWith(2, {
      game: 'g1',
      type: 'snap',
      seq: 1,
      payload: { x: 1 },
    })
  })

  it('stop() halts further broadcasts', () => {
    vi.useFakeTimers()
    const { transport } = createFakeTransport()
    const sender = createHostSnapshot({ net: transport, game: 'g1', getState: () => 0, hz: 10 })
    sender.start()
    vi.advanceTimersByTime(100)
    sender.stop()
    vi.advanceTimersByTime(500)
    expect(transport.broadcastUnreliable).toHaveBeenCalledTimes(1)
  })
})

describe('createSnapshotReceiver', () => {
  it('feeds matching snap messages into the buffer', () => {
    const { transport, emit } = createFakeTransport()
    const { buffer } = createSnapshotReceiver<{ x: number }>({ net: transport, game: 'g1', hostId: 'peerA' })

    const msg: GameNetMessage = { game: 'g1', type: 'snap', seq: 1, payload: { x: 7 } }
    emit('message', 'peerA', msg)

    expect(buffer.latest()).toEqual({ x: 7 })
  })

  it('ignores messages for a different game or type', () => {
    const { transport, emit } = createFakeTransport()
    const { buffer } = createSnapshotReceiver<{ x: number }>({ net: transport, game: 'g1', hostId: 'peerA' })

    emit('message', 'peerA', { game: 'other', type: 'snap', seq: 1, payload: { x: 1 } })
    emit('message', 'peerA', { game: 'g1', type: 'own', seq: 1, payload: { x: 1 } })

    expect(buffer.latest()).toBeNull()
  })

  it('ignores snap messages from a peer that is not the host (C1 host authority)', () => {
    const { transport, emit } = createFakeTransport()
    const { buffer } = createSnapshotReceiver<{ x: number }>({ net: transport, game: 'g1', hostId: 'host' })

    emit('message', 'attacker', { game: 'g1', type: 'snap', seq: 999, payload: { x: 666 } })
    expect(buffer.latest()).toBeNull()

    emit('message', 'host', { game: 'g1', type: 'snap', seq: 1, payload: { x: 7 } })
    expect(buffer.latest()).toEqual({ x: 7 })
  })

  it('dispose() unsubscribes so later messages no longer update the buffer', () => {
    const { transport, emit } = createFakeTransport()
    const { buffer, dispose } = createSnapshotReceiver<{ x: number }>({ net: transport, game: 'g1', hostId: 'peerA' })

    emit('message', 'peerA', { game: 'g1', type: 'snap', seq: 1, payload: { x: 1 } })
    dispose()
    emit('message', 'peerA', { game: 'g1', type: 'snap', seq: 2, payload: { x: 2 } })

    expect(buffer.latest()).toEqual({ x: 1 })
  })
})
