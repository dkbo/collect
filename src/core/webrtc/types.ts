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
