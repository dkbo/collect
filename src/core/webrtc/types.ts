/** 統一遊戲層訊息格式（沿用計畫 §4.1：game 命名空間 + type + payload） */
export interface GameNetMessage {
  game: string
  type: string
  payload?: unknown
  /** unreliable 高頻訊息的遞增序號；收端以此丟棄晚到的舊包 */
  seq?: number
}

/** 網路事件：連線/離線與訊息 */
export type NetEvent = 'message' | 'peerJoin' | 'peerLeave' | 'open' | 'close'

/** 事件回呼簽章 */
export interface NetEventMap {
  message: (from: string, msg: GameNetMessage) => void
  peerJoin: (peerId: string) => void
  peerLeave: (peerId: string) => void
  open: (peerId: string) => void
  close: (peerId: string) => void
}

/**
 * 傳輸層抽象（計畫 §4.1）。遊戲只對此介面收發，不需知道底層 P2P 細節。
 * reliable 通道走 send/broadcast；位置等高頻資料用 *Unreliable 變體。
 */
export interface NetTransport {
  send(peerId: string, data: GameNetMessage): void
  broadcast(data: GameNetMessage): void
  sendUnreliable(peerId: string, data: GameNetMessage): void
  broadcastUnreliable(data: GameNetMessage): void
  on<E extends NetEvent>(event: E, cb: NetEventMap[E]): () => void
}

/** signaling 訊息種類（SDP 交換與 ICE candidate） */
export type SignalKind = 'offer' | 'answer' | 'ice'

/**
 * 一則 signaling 訊息（傳輸層無關）。
 * createdAt 為新鮮度用的時間戳，實作可為任意型別（Firestore Timestamp 等），
 * mesh 端以鴨子型別讀取（toMillis() / seconds），讀不出即視為過期。
 */
export interface SignalMessage {
  id: string
  from: string
  to: string
  kind: SignalKind
  data: unknown
  createdAt?: unknown
}

/** 尚未帶 id/時間戳的送出內容 */
export type OutgoingSignal = Omit<SignalMessage, 'id' | 'createdAt'>

/**
 * signaling 通道抽象（架構審查 G2）。
 * core/webrtc 不再直接相依 Firestore：由呼叫端（useNetStore）注入實作，
 * 測試則注入假物件。
 */
export interface MeshSignaling {
  send(roomId: string, sig: OutgoingSignal): Promise<unknown>
  subscribe(roomId: string, selfId: string, onSignal: (sig: SignalMessage) => void): () => void
  delete(roomId: string, signalId: string): Promise<void>
}
