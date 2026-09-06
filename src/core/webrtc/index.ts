/**
 * WebRTC full-mesh 傳輸層（計畫 §4.2）。
 *
 * - 1~4 人 mesh：每對 peer 建一條 RTCPeerConnection；最多 3 條/人。
 * - 防 glare：每對之中由「uid 字典序較小」者主動發 offer，另一方等待。
 * - DataChannel 採 negotiated（兩端各自以相同 id 建立，免 ondatachannel 協商）：
 *     id 0 = reliable（ordered，指令/事件）
 *     id 1 = unreliable（ordered:false, maxRetransmits:0，位置高頻）
 * - Signaling 由呼叫端注入（MeshOptions.signaling，實作見 core/room/signaling）；
 *   ICE 在 remote SDP 設定前先緩衝。
 */
import type {
  GameNetMessage,
  MeshSignaling,
  NetEvent,
  NetEventMap,
  NetTransport,
  OutgoingSignal,
  SignalMessage,
} from './types'

const RTC_CONFIG: RTCConfiguration = {
  // 免費 STUN；無 TURN，對稱 NAT 可能連不上（計畫 §8 已知限制）
  iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
}

interface PeerConn {
  pc: RTCPeerConnection
  reliable: RTCDataChannel
  unreliable: RTCDataChannel
  /** remote SDP 設定前先暫存的 ICE candidate */
  pendingIce: RTCIceCandidateInit[]
  remoteSet: boolean
  /** 已判定離開（close/peerLeave 只發一次） */
  gone: boolean
  /** disconnected 寬限計時器（可能自行恢復） */
  graceTimer: ReturnType<typeof setTimeout> | null
}

/** disconnected 狀態的恢復寬限期；逾時仍未回到 connected 即視為離開 */
const DISCONNECT_GRACE_MS = 5000
/** 斷線後的重連退避（毫秒）；用完即放棄該 peer */
const RECONNECT_DELAYS_MS = [1000, 2000, 4000]
/** 已處理 signal id 的記憶上限（FIFO）：擋掉重播與 onSnapshot 重複派送 */
const MAX_HANDLED_SIGNALS = 500
/** signal 新鮮度上限；超過（或讀不出時間戳）即視為過期殘留，直接刪除不處理 */
const SIGNAL_MAX_AGE_MS = 30_000

export interface Mesh extends NetTransport {
  /** 開始建立 mesh：訂閱 signaling 並對較大 uid 的 peer 發起連線 */
  start(): void
  /** 關閉所有連線並取消訂閱 */
  stop(): void
  /**
   * 更新房內玩家白名單：非名單內的 signal 一律丟棄，已連上的移除者關閉連線；
   * 新加入且尚未連線者由 uid 較小的一端發起 offer。
   */
  updatePeers(ids: string[]): void
}

export interface MeshOptions {
  roomId: string
  selfId: string
  /** 房內所有玩家 uid（含自己） */
  peerIds: string[]
  /** signaling 通道實作（Firestore / 測試替身），由呼叫端注入 */
  signaling: MeshSignaling
}

export const createMesh = ({ roomId, selfId, peerIds, signaling }: MeshOptions): Mesh => {
  const peers = new Map<string, PeerConn>()
  /** 房內玩家白名單（含自己）；只有名單內的 uid 能與我方協商連線 */
  let allowed = new Set(peerIds)
  /** 已對外 emit 過 peerJoin 的 uid，避免 updatePeers 重複觸發 */
  const announced = new Set<string>()
  /** 已處理過的 signal id（配合 handledOrder 做 FIFO 汰換） */
  const handledSignals = new Set<string>()
  const handledOrder: string[] = []
  /** 每個 peer 已用掉的重連次數與待觸發計時器 */
  const retryCounts = new Map<string, number>()
  const retryTimers = new Map<string, ReturnType<typeof setTimeout>>()
  const listeners: { [E in NetEvent]: Set<NetEventMap[E]> } = {
    message: new Set(),
    peerJoin: new Set(),
    peerLeave: new Set(),
    open: new Set(),
    close: new Set(),
  }
  let unsubSignals: (() => void) | null = null
  let stopped = false

  const emit = <E extends NetEvent>(event: E, ...args: Parameters<NetEventMap[E]>) => {
    // 以 any 轉發：listeners[event] 與 args 同源自相同 E，型別安全由公開 API 保證
    listeners[event].forEach((cb) => (cb as (...a: unknown[]) => void)(...args))
  }

  const post = (sig: OutgoingSignal) => {
    if (!stopped) void signaling.send(roomId, sig)
  }

  /** 判定 peer 離開：emit close + peerLeave 各一次，關閉連線並從 mesh 移除 */
  const markGone = (peerId: string) => {
    const conn = peers.get(peerId)
    if (!conn || conn.gone) return
    conn.gone = true
    if (conn.graceTimer) clearTimeout(conn.graceTimer)
    conn.pc.onconnectionstatechange = null
    conn.pc.close()
    peers.delete(peerId)
    // 已對外宣告離開：重連成功時要重新 emit peerJoin，遊戲層才會重建代理物件
    announced.delete(peerId)
    emit('close', peerId)
    emit('peerLeave', peerId)
    scheduleReconnect(peerId)
  }

  /**
   * 斷線重連（指數退避 1s/2s/4s，共 3 次）。
   * 只有 uid 較小的一端主動重連，避免兩端同時發 offer 產生 glare；
   * 次數用完或已不在白名單即放棄（close 已於 markGone 發出）。
   */
  const scheduleReconnect = (peerId: string) => {
    if (stopped || !allowed.has(peerId) || peerId === selfId) return
    if (!(selfId < peerId)) return
    const used = retryCounts.get(peerId) ?? 0
    if (used >= RECONNECT_DELAYS_MS.length) return
    retryCounts.set(peerId, used + 1)
    if (retryTimers.has(peerId)) return
    const timer = setTimeout(() => {
      retryTimers.delete(peerId)
      if (stopped || !allowed.has(peerId) || peers.has(peerId)) return
      void connectTo(peerId)
    }, RECONNECT_DELAYS_MS[used])
    retryTimers.set(peerId, timer)
  }

  const makePeer = (peerId: string): PeerConn => {
    const pc = new RTCPeerConnection(RTC_CONFIG)
    const reliable = pc.createDataChannel('reliable', { negotiated: true, id: 0 })
    const unreliable = pc.createDataChannel('unreliable', {
      negotiated: true,
      id: 1,
      ordered: false,
      maxRetransmits: 0,
    })
    const conn: PeerConn = {
      pc,
      reliable,
      unreliable,
      pendingIce: [],
      remoteSet: false,
      gone: false,
      graceTimer: null,
    }
    peers.set(peerId, conn)

    pc.onicecandidate = (e) => {
      if (e.candidate) post({ from: selfId, to: peerId, kind: 'ice', data: e.candidate.toJSON() })
    }
    pc.onconnectionstatechange = () => {
      const state = pc.connectionState
      if (state === 'failed' || state === 'closed') {
        markGone(peerId)
      } else if (state === 'disconnected') {
        // disconnected 可能短暫恢復，給寬限期再判離開
        conn.graceTimer ??= setTimeout(() => markGone(peerId), DISCONNECT_GRACE_MS)
      } else if (state === 'connected' && conn.graceTimer) {
        clearTimeout(conn.graceTimer)
        conn.graceTimer = null
      }
    }

    const onMessage = (e: MessageEvent) => {
      try {
        emit('message', peerId, JSON.parse(e.data as string) as GameNetMessage)
      } catch {
        /* 非預期 payload，略過 */
      }
    }
    reliable.onmessage = onMessage
    unreliable.onmessage = onMessage
    reliable.onopen = () => {
      retryCounts.delete(peerId) // 連上即重置退避次數
      // 斷線重連：peerLeave 時遊戲層已銷毀該 peer 的代理物件，需先補 peerJoin 才不會永久隱形
      if (!announced.has(peerId)) {
        announced.add(peerId)
        emit('peerJoin', peerId)
      }
      emit('open', peerId)
    }

    return conn
  }

  const drainIce = async (conn: PeerConn) => {
    for (const cand of conn.pendingIce) {
      try {
        await conn.pc.addIceCandidate(cand)
      } catch {
        /* 過期/重複 candidate，忽略 */
      }
    }
    conn.pendingIce = []
  }

  // 我方為較小 uid → 主動發 offer
  const connectTo = async (peerId: string) => {
    if (stopped || peers.has(peerId) || !allowed.has(peerId)) return
    const conn = makePeer(peerId)
    try {
      const offer = await conn.pc.createOffer()
      await conn.pc.setLocalDescription(offer)
      post({ from: selfId, to: peerId, kind: 'offer', data: { type: offer.type, sdp: offer.sdp } })
    } catch (err) {
      console.warn('[mesh] offer 失敗', peerId, err)
      markGone(peerId)
    }
  }

  /**
   * signal 新鮮度：createdAt 為 Firestore serverTimestamp（rules 強制 create 時 == request.time）。
   * 型別未在 signaling 模組宣告，這裡以鴨子型別讀取。
   * fail-closed：缺欄位或讀不出毫秒數一律視為過期——合法寫入必定帶得出時間戳。
   */
  const isStale = (sig: SignalMessage): boolean => {
    const raw = (sig as unknown as { createdAt?: unknown }).createdAt
    if (!raw || typeof raw !== 'object') return true
    const ts = raw as { toMillis?: () => number; seconds?: number }
    const ms = typeof ts.toMillis === 'function' ? ts.toMillis() : ts.seconds ? ts.seconds * 1000 : NaN
    if (!Number.isFinite(ms)) return true
    return Date.now() - ms > SIGNAL_MAX_AGE_MS
  }

  /**
   * 丟棄已失效的殘留連線（disconnected/failed/closed），讓對方的重連 offer 能建新 pc。
   * 不 emit close/peerLeave（markGone 已發過或稍後會發），也不排重連。
   */
  const dropDeadPeer = (peerId: string) => {
    const conn = peers.get(peerId)
    if (!conn) return
    const state = conn.pc.connectionState
    if (state !== 'disconnected' && state !== 'failed' && state !== 'closed') return
    if (conn.graceTimer) clearTimeout(conn.graceTimer)
    conn.pc.onconnectionstatechange = null
    conn.pc.onicecandidate = null
    conn.reliable.onmessage = null
    conn.unreliable.onmessage = null
    conn.pc.close()
    peers.delete(peerId)
  }

  /** 記錄已處理的 signal id；回傳 false 表示先前已處理過（重播/重複派送） */
  const markHandled = (id: string): boolean => {
    if (handledSignals.has(id)) return false
    handledSignals.add(id)
    handledOrder.push(id)
    if (handledOrder.length > MAX_HANDLED_SIGNALS) {
      const oldest = handledOrder.shift()
      if (oldest !== undefined) handledSignals.delete(oldest)
    }
    return true
  }

  const handleSignal = async (sig: SignalMessage) => {
    // 白名單：非房內玩家（或冒用自己 uid）的 signal 一律不協商，直接刪除
    if (sig.from === selfId || !allowed.has(sig.from)) {
      void signaling.delete(roomId, sig.id)
      return
    }
    // 重播防護：同一份文件被重複派送（重新訂閱、離線快取）只處理一次
    if (!markHandled(sig.id)) return
    // 新鮮度：逾時殘留的 signal 直接清掉，不拿舊 SDP 重建連線
    if (isStale(sig)) {
      void signaling.delete(roomId, sig.id)
      return
    }
    try {
      if (sig.kind === 'offer') {
        // 對方重連送來的新 offer 不可打在已壞掉的舊 pc 上（會拋 InvalidStateError，
        // 白等一輪退避）。靜默丟棄殘連即可——close/peerLeave 早在 markGone 發過了。
        dropDeadPeer(sig.from)
        const conn = peers.get(sig.from) ?? makePeer(sig.from)
        await conn.pc.setRemoteDescription(sig.data as RTCSessionDescriptionInit)
        conn.remoteSet = true
        await drainIce(conn)
        const answer = await conn.pc.createAnswer()
        await conn.pc.setLocalDescription(answer)
        post({ from: selfId, to: sig.from, kind: 'answer', data: { type: answer.type, sdp: answer.sdp } })
      } else if (sig.kind === 'answer') {
        const conn = peers.get(sig.from)
        if (conn) {
          await conn.pc.setRemoteDescription(sig.data as RTCSessionDescriptionInit)
          conn.remoteSet = true
          await drainIce(conn)
        }
      } else {
        const conn = peers.get(sig.from) ?? makePeer(sig.from)
        if (conn.remoteSet) {
          await conn.pc.addIceCandidate(sig.data as RTCIceCandidateInit)
        } else {
          conn.pendingIce.push(sig.data as RTCIceCandidateInit)
        }
      }
    } catch (err) {
      // SDP/ICE 套用失敗代表這條連線已不可用，判定該 peer 離開（並走重連退避）
      console.warn('[mesh] signal 處理失敗', sig.kind, sig.from, err)
      markGone(sig.from)
    } finally {
      void signaling.delete(roomId, sig.id)
    }
  }

  const channelFor = (peerId: string, reliable: boolean): RTCDataChannel | null => {
    const conn = peers.get(peerId)
    if (!conn) return null
    const ch = reliable ? conn.reliable : conn.unreliable
    return ch.readyState === 'open' ? ch : null
  }

  const sendOn = (peerId: string, data: GameNetMessage, reliable: boolean) => {
    channelFor(peerId, reliable)?.send(JSON.stringify(data))
  }
  const broadcastOn = (data: GameNetMessage, reliable: boolean) => {
    const json = JSON.stringify(data)
    for (const peerId of peers.keys()) channelFor(peerId, reliable)?.send(json)
  }

  return {
    start() {
      stopped = false
      unsubSignals = signaling.subscribe(roomId, selfId, (sig) => void handleSignal(sig))
      for (const peerId of allowed) {
        if (peerId === selfId) continue
        announced.add(peerId)
        emit('peerJoin', peerId)
        if (selfId < peerId) void connectTo(peerId)
      }
    },
    updatePeers(ids) {
      allowed = new Set(ids)
      // 已離開房間者：關連線（markGone 會因不在白名單而不重連）
      for (const peerId of [...peers.keys()]) {
        if (!allowed.has(peerId)) markGone(peerId)
      }
      for (const [peerId, timer] of retryTimers) {
        if (allowed.has(peerId)) continue
        clearTimeout(timer)
        retryTimers.delete(peerId)
      }
      if (stopped) return
      for (const peerId of allowed) {
        if (peerId === selfId || peers.has(peerId)) continue
        if (!announced.has(peerId)) {
          announced.add(peerId)
          emit('peerJoin', peerId)
        }
        retryCounts.delete(peerId) // 重新入列的 peer 重置退避
        if (selfId < peerId) void connectTo(peerId)
      }
    },
    stop() {
      stopped = true
      unsubSignals?.()
      unsubSignals = null
      for (const timer of retryTimers.values()) clearTimeout(timer)
      retryTimers.clear()
      retryCounts.clear()
      // 先蒐集 id：emit 期間監聽者可能再操作 peers
      const remaining = [...peers.keys()]
      for (const [, conn] of peers) {
        if (conn.graceTimer) clearTimeout(conn.graceTimer)
        conn.reliable.onmessage = null
        conn.unreliable.onmessage = null
        conn.pc.onicecandidate = null
        conn.pc.onconnectionstatechange = null
        conn.pc.close()
      }
      peers.clear()
      announced.clear()
      // 通知遊戲層清理各 peer 的代理物件與插值 buffer
      for (const peerId of remaining) {
        emit('close', peerId)
        emit('peerLeave', peerId)
      }
    },
    send: (peerId, data) => sendOn(peerId, data, true),
    broadcast: (data) => broadcastOn(data, true),
    sendUnreliable: (peerId, data) => sendOn(peerId, data, false),
    broadcastUnreliable: (data) => broadcastOn(data, false),
    on(event, cb) {
      listeners[event].add(cb)
      return () => listeners[event].delete(cb)
    },
  }
}

export type {
  GameNetMessage,
  MeshSignaling,
  NetEvent,
  NetEventMap,
  NetTransport,
  OutgoingSignal,
  SignalKind,
  SignalMessage,
} from './types'
export { createNoopTransport } from './noopTransport'
