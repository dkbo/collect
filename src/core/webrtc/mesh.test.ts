import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import type { Signal } from '@/core/room/signaling'

/**
 * mesh 的 signaling 閘門測試（安全審查 B1/B3/B4）。
 *
 * Firestore signaling 整組 mock 掉；RTCPeerConnection 以最小假物件替身，
 * 因此不需要真的 WebRTC 堆疊即可驗證白名單、去重、新鮮度與生命週期。
 */

const h = vi.hoisted(() => ({
  sendSignal:
    vi.fn<(roomId: string, sig: { from: string; to: string; kind: string; data: unknown }) => Promise<void>>(),
  deleteSignal: vi.fn<(roomId: string, signalId: string) => Promise<void>>(),
  onSignal: null as ((sig: Signal) => void) | null,
  unsub: vi.fn(),
}))

vi.mock('@/core/room/signaling', () => ({
  sendSignal: h.sendSignal,
  deleteSignal: h.deleteSignal,
  subscribeSignals: (_roomId: string, _selfId: string, cb: (sig: Signal) => void) => {
    h.onSignal = cb
    return h.unsub
  },
}))

const { createMesh } = await import('./index')

interface FakeChannel {
  id: number
  readyState: string
  send: (data: string) => void
  onmessage: ((e: MessageEvent) => void) | null
  onopen: (() => void) | null
}

/** 最小 RTCPeerConnection 替身：只提供 mesh 會用到的方法 */
class FakePeerConnection {
  static instances: FakePeerConnection[] = []
  connectionState = 'new'
  onicecandidate: unknown = null
  onconnectionstatechange: (() => void) | null = null
  channels: FakeChannel[] = []
  close = vi.fn()

  constructor() {
    FakePeerConnection.instances.push(this)
  }
  /** reliable 通道（id 0）——mesh 於其 onopen 發出 peerJoin/open */
  get reliable(): FakeChannel {
    return this.channels[0]
  }
  createDataChannel(_label: string, opts: { id: number }): FakeChannel {
    const ch: FakeChannel = {
      id: opts.id,
      readyState: 'connecting',
      send: vi.fn(),
      onmessage: null,
      onopen: null,
    }
    this.channels.push(ch)
    return ch
  }
  createOffer = () => Promise.resolve({ type: 'offer', sdp: 'OFFER' })
  createAnswer = () => Promise.resolve({ type: 'answer', sdp: 'ANSWER' })
  setLocalDescription = () => Promise.resolve()
  setRemoteDescription = () => Promise.resolve()
  addIceCandidate = () => Promise.resolve()
}

const flush = async () => {
  for (let i = 0; i < 5; i++) await Promise.resolve()
}

/** 合法 signal：rules 保證 create 時帶 createdAt == request.time */
const offerFrom = (from: string, id = `sig-${from}`): Signal =>
  ({
    id,
    from,
    to: 'b',
    kind: 'offer',
    data: { type: 'offer', sdp: 'REMOTE' },
    createdAt: { toMillis: () => Date.now() },
  }) as unknown as Signal

const answersSent = () => h.sendSignal.mock.calls.filter(([, sig]) => sig.kind === 'answer')

beforeEach(() => {
  FakePeerConnection.instances = []
  h.onSignal = null
  ;(globalThis as unknown as { RTCPeerConnection: unknown }).RTCPeerConnection = FakePeerConnection
})

afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
})

/** selfId 固定為 'b'：'a' 比我小（由對方發 offer），'c'/'d' 比我大（由我發 offer） */
const makeMesh = (peerIds = ['a', 'b', 'c']) =>
  createMesh({ roomId: 'room1', selfId: 'b', peerIds })

describe('createMesh — peer 白名單', () => {
  it('start() 只對名單內、uid 較大的 peer 發起連線，並對每個 peer 發 peerJoin', () => {
    const mesh = makeMesh()
    const joined: string[] = []
    mesh.on('peerJoin', (id) => joined.push(id))

    mesh.start()

    expect(joined.sort()).toEqual(['a', 'c'])
    expect(FakePeerConnection.instances).toHaveLength(1) // 只有對 'c' 主動發 offer
  })

  it('丟棄不在名單內的 signal：不建連線、不回 answer，直接刪除該文件', async () => {
    const mesh = makeMesh()
    mesh.start()
    const before = FakePeerConnection.instances.length

    h.onSignal?.(offerFrom('attacker'))
    await flush()

    expect(FakePeerConnection.instances).toHaveLength(before)
    expect(answersSent()).toHaveLength(0)
    expect(h.deleteSignal).toHaveBeenCalledWith('room1', 'sig-attacker')
  })

  it('丟棄冒用自己 uid 的 signal', async () => {
    const mesh = makeMesh()
    mesh.start()
    const before = FakePeerConnection.instances.length

    h.onSignal?.({ ...offerFrom('a'), from: 'b', id: 'spoof' })
    await flush()

    expect(FakePeerConnection.instances).toHaveLength(before)
    expect(answersSent()).toHaveLength(0)
  })

  it('名單內的 offer 正常協商並回送 answer', async () => {
    const mesh = makeMesh()
    mesh.start()

    h.onSignal?.(offerFrom('a'))
    await flush()

    expect(answersSent()).toHaveLength(1)
    expect(h.deleteSignal).toHaveBeenCalledWith('room1', 'sig-a')
  })
})

describe('createMesh — signal 去重與新鮮度', () => {
  it('同一個 signal id 重複派送只處理一次', async () => {
    const mesh = makeMesh()
    mesh.start()

    h.onSignal?.(offerFrom('a', 'dup'))
    await flush()
    h.onSignal?.(offerFrom('a', 'dup'))
    await flush()

    expect(answersSent()).toHaveLength(1)
  })

  it('過期的 signal 直接刪除、不協商', async () => {
    const mesh = makeMesh()
    mesh.start()

    const stale = {
      ...offerFrom('a', 'stale'),
      createdAt: { toMillis: () => Date.now() - 61_000 },
    } as unknown as Signal
    h.onSignal?.(stale)
    await flush()

    expect(answersSent()).toHaveLength(0)
    expect(h.deleteSignal).toHaveBeenCalledWith('room1', 'stale')
  })

  it('缺 createdAt（或讀不出時間戳）一律視為過期並刪除：fail-closed', async () => {
    const mesh = makeMesh()
    mesh.start()

    const noTs = { ...offerFrom('a', 'no-ts') } as Record<string, unknown>
    delete noTs.createdAt
    h.onSignal?.(noTs as unknown as Signal)
    await flush()

    expect(answersSent()).toHaveLength(0)
    expect(h.deleteSignal).toHaveBeenCalledWith('room1', 'no-ts')
  })

  it('createdAt 超過 30 秒即過期（29 秒仍受理）', async () => {
    const mesh = makeMesh()
    mesh.start()

    const old = {
      ...offerFrom('a', 'age-31'),
      createdAt: { toMillis: () => Date.now() - 31_000 },
    } as unknown as Signal
    const fresh = {
      ...offerFrom('a', 'age-29'),
      createdAt: { toMillis: () => Date.now() - 29_000 },
    } as unknown as Signal

    h.onSignal?.(old)
    await flush()
    expect(answersSent()).toHaveLength(0)

    h.onSignal?.(fresh)
    await flush()
    expect(answersSent()).toHaveLength(1)
  })

  it('收到 offer 時先丟棄已失效的殘留連線，重連 offer 才能建新 pc', async () => {
    const mesh = makeMesh(['a', 'b']) // 'a' < 'b'：由對方發 offer，我方只回 answer
    mesh.start()

    h.onSignal?.(offerFrom('a', 'o1'))
    await flush()
    expect(FakePeerConnection.instances).toHaveLength(1)

    // 舊 pc 壞掉但寬限期未到（尚未 markGone），對方已重連送新 offer
    const pc1 = FakePeerConnection.instances[0]
    pc1.connectionState = 'failed'

    h.onSignal?.(offerFrom('a', 'o2'))
    await flush()

    expect(FakePeerConnection.instances).toHaveLength(2)
    expect(pc1.close).toHaveBeenCalled()
    expect(answersSent()).toHaveLength(2)
  })
})

describe('createMesh — updatePeers 與生命週期', () => {
  it('updatePeers() 加入新玩家會發起連線，移除的玩家會被關閉', () => {
    const mesh = makeMesh()
    mesh.start()
    const closed: string[] = []
    mesh.on('close', (id) => closed.push(id))
    const before = FakePeerConnection.instances.length

    mesh.updatePeers(['a', 'b', 'c', 'd'])
    expect(FakePeerConnection.instances.length).toBe(before + 1) // 對 'd' 發 offer

    mesh.updatePeers(['a', 'b'])
    expect(closed).toContain('c')
  })

  it('updatePeers() 移出名單後，其 signal 也不再被受理', async () => {
    const mesh = makeMesh()
    mesh.start()
    mesh.updatePeers(['b', 'c'])

    h.onSignal?.(offerFrom('a', 'kicked'))
    await flush()

    expect(answersSent()).toHaveLength(0)
    expect(h.deleteSignal).toHaveBeenCalledWith('room1', 'kicked')
  })

  it('斷線重連成功後補發 peerJoin，避免遊戲層代理物件永久消失', async () => {
    vi.useFakeTimers()
    const mesh = makeMesh()
    const joined: string[] = []
    const opened: string[] = []
    const left: string[] = []
    mesh.on('peerJoin', (id) => joined.push(id))
    mesh.on('open', (id) => opened.push(id))
    mesh.on('peerLeave', (id) => left.push(id))

    mesh.start()
    const pc1 = FakePeerConnection.instances[0]
    pc1.reliable.onopen?.()
    expect(joined).toEqual(['a', 'c']) // start 當下宣告，open 不重複發
    expect(opened).toEqual(['c'])

    // 連線失敗 → close/peerLeave，遊戲層銷毀 'c' 的代理物件
    pc1.connectionState = 'failed'
    pc1.onconnectionstatechange?.()
    expect(left).toEqual(['c'])

    // 退避 1 秒後重連並連上
    vi.advanceTimersByTime(1000)
    await flush()
    const pc2 = FakePeerConnection.instances[1]
    expect(pc2).toBeDefined()
    pc2.reliable.onopen?.()

    expect(joined).toEqual(['a', 'c', 'c']) // 補發一次，遊戲層據此重建
    expect(opened).toEqual(['c', 'c'])
  })

  it('stop() 對仍在的 peer 發出 close/peerLeave，讓遊戲層能清理代理物件', () => {
    const mesh = makeMesh()
    mesh.start()
    const closed: string[] = []
    const left: string[] = []
    mesh.on('close', (id) => closed.push(id))
    mesh.on('peerLeave', (id) => left.push(id))

    mesh.stop()

    expect(closed).toEqual(['c'])
    expect(left).toEqual(['c'])
    expect(h.unsub).toHaveBeenCalled()
  })
})
