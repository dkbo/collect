/**
 * WebRTC full-mesh 傳輸層（計畫 §4.2）。
 *
 * - 1~4 人 mesh：每對 peer 建一條 RTCPeerConnection；最多 3 條/人。
 * - 防 glare：每對之中由「uid 字典序較小」者主動發 offer，另一方等待。
 * - DataChannel 採 negotiated（兩端各自以相同 id 建立，免 ondatachannel 協商）：
 *     id 0 = reliable（ordered，指令/事件）
 *     id 1 = unreliable（ordered:false, maxRetransmits:0，位置高頻）
 * - Signaling 經 Firestore（見 core/room/signaling）；ICE 在 remote SDP 設定前先緩衝。
 */
import { deleteSignal, sendSignal, subscribeSignals, type Signal } from '@/core/room/signaling'
import type { GameNetMessage, NetEvent, NetEventMap, NetTransport } from './types'

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

export interface Mesh extends NetTransport {
  /** 開始建立 mesh：訂閱 signaling 並對較大 uid 的 peer 發起連線 */
  start(): void
  /** 關閉所有連線並取消訂閱 */
  stop(): void
}

export interface MeshOptions {
  roomId: string
  selfId: string
  /** 房內所有玩家 uid（含自己） */
  peerIds: string[]
}

export const createMesh = ({ roomId, selfId, peerIds }: MeshOptions): Mesh => {
  const peers = new Map<string, PeerConn>()
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

  const post = (sig: Parameters<typeof sendSignal>[1]) => {
    if (!stopped) void sendSignal(roomId, sig)
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
    emit('close', peerId)
    emit('peerLeave', peerId)
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
    reliable.onopen = () => emit('open', peerId)

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
    const conn = makePeer(peerId)
    const offer = await conn.pc.createOffer()
    await conn.pc.setLocalDescription(offer)
    post({ from: selfId, to: peerId, kind: 'offer', data: { type: offer.type, sdp: offer.sdp } })
  }

  const handleSignal = async (sig: Signal) => {
    try {
      if (sig.kind === 'offer') {
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
    } finally {
      void deleteSignal(roomId, sig.id)
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
      unsubSignals = subscribeSignals(roomId, selfId, (sig) => void handleSignal(sig))
      for (const peerId of peerIds) {
        if (peerId === selfId) continue
        emit('peerJoin', peerId)
        if (selfId < peerId) void connectTo(peerId)
      }
    },
    stop() {
      stopped = true
      unsubSignals?.()
      unsubSignals = null
      for (const [, conn] of peers) {
        if (conn.graceTimer) clearTimeout(conn.graceTimer)
        conn.reliable.onmessage = null
        conn.unreliable.onmessage = null
        conn.pc.onicecandidate = null
        conn.pc.onconnectionstatechange = null
        conn.pc.close()
      }
      peers.clear()
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

export type { GameNetMessage, NetEvent, NetEventMap, NetTransport } from './types'
