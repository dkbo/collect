/**
 * Snapshot 同步工具（Phase A 工具層）。
 *
 * - SnapshotBuffer：收端插值緩衝。以本地收包時間戳記，回放點 = now - delayMs，
 *   取目標時刻前後兩筆快照與 alpha 供遊戲 lerp；seq 過濾晚到的舊包（unreliable 必備）。
 * - createHostSnapshot / createSnapshotReceiver：Host Authority 配對——
 *   host 以固定頻率 broadcastUnreliable 全場狀態，guest 收進 buffer 插值。
 *
 * 保留訊息 type：'snap'（snapshotSync）、'own'（ownership）、'flow'（gameFlow），
 * 遊戲自訂訊息請避開。
 */
import type { GameNetMessage, NetTransport } from '@/core/webrtc'

/** sample() 結果：在 a、b 之間以 alpha（0~1）插值 */
export interface SnapshotPair<T> {
  a: T
  b: T
  alpha: number
}

export interface SnapshotBuffer<T> {
  /**
   * 收到一筆快照（seq 過期即丟棄；以本地時間戳記）。
   * seq 去重為 per-sender（安全審查 C1）：不同來源各自記錄 lastSeq，
   * 避免任一 peer 送出超大 seq 就讓其他來源後續快照全被丟棄。
   */
  push(seq: number, state: T, from?: string): void
  /** 取回放點（now - delayMs）前後快照；buffer 空回 null */
  sample(): SnapshotPair<T> | null
  /** 最新一筆（無插值），用於初始化或除錯 */
  latest(): T | null
  clear(): void
}

/** 早於回放點此毫秒數的舊快照即修剪 */
const TRIM_BEFORE_MS = 1000

export const createSnapshotBuffer = <T>(delayMs = 100): SnapshotBuffer<T> => {
  const entries: { t: number; state: T }[] = []
  /** 每個來源各自的最後 seq（未指定來源時歸在 '' 這把 key） */
  const lastSeqBySender = new Map<string, number>()

  return {
    push(seq, state, from = '') {
      if (!Number.isFinite(seq)) return
      if (seq <= (lastSeqBySender.get(from) ?? -1)) return
      lastSeqBySender.set(from, seq)
      entries.push({ t: performance.now(), state })
    },
    sample() {
      if (entries.length === 0) return null
      const target = performance.now() - delayMs
      // 修剪：保留 target 之前最後一筆作為插值起點
      while (entries.length > 2 && entries[1].t < target - TRIM_BEFORE_MS) entries.shift()

      // target 落在最舊之前 → 直接用最舊；落在最新之後 → 停在最新
      if (target <= entries[0].t) return { a: entries[0].state, b: entries[0].state, alpha: 0 }
      const newest = entries[entries.length - 1]
      if (target >= newest.t) return { a: newest.state, b: newest.state, alpha: 0 }

      for (let i = entries.length - 2; i >= 0; i--) {
        if (entries[i].t <= target) {
          const a = entries[i]
          const b = entries[i + 1]
          const span = b.t - a.t
          return { a: a.state, b: b.state, alpha: span > 0 ? (target - a.t) / span : 0 }
        }
      }
      return { a: entries[0].state, b: entries[0].state, alpha: 0 }
    },
    latest() {
      return entries.length ? entries[entries.length - 1].state : null
    },
    clear() {
      entries.length = 0
      lastSeqBySender.clear()
    },
  }
}

/** Host 端：固定頻率廣播全場快照 */
export interface HostSnapshotSender {
  start(): void
  stop(): void
}

export const createHostSnapshot = <T>(opts: {
  net: NetTransport
  /** 遊戲命名空間（= GameModule.gameId） */
  game: string
  getState: () => T
  /** 廣播頻率，預設 12Hz（host authority 全場狀態夠用） */
  hz?: number
}): HostSnapshotSender => {
  const { net, game, getState, hz = 12 } = opts
  let timer: ReturnType<typeof setInterval> | null = null
  let seq = 0

  return {
    start() {
      if (timer) return
      timer = setInterval(() => {
        net.broadcastUnreliable({ game, type: 'snap', seq: seq++, payload: getState() })
      }, 1000 / hz)
    },
    stop() {
      if (timer) clearInterval(timer)
      timer = null
    },
  }
}

/** Guest 端：訂閱 host 快照進插值 buffer */
export const createSnapshotReceiver = <T>(opts: {
  net: NetTransport
  game: string
  /** 房主 uid：只接受來自它的全場快照（安全審查 C1） */
  hostId: string
  /** 插值延遲，預設 100ms（吸收抖動，代價是畫面晚 100ms） */
  delayMs?: number
}): { buffer: SnapshotBuffer<T>; dispose(): void } => {
  const { net, game, hostId, delayMs = 100 } = opts
  const buffer = createSnapshotBuffer<T>(delayMs)
  const off = net.on('message', (from: string, msg: GameNetMessage) => {
    if (msg.game !== game || msg.type !== 'snap') return
    // 全場快照為 host authority 專屬；其他 peer 冒名送 snap 一律丟棄
    if (from !== hostId) return
    buffer.push(msg.seq ?? 0, msg.payload as T, from)
  })
  return { buffer, dispose: off }
}
