/**
 * 分散式所有權同步（Phase A 工具層；賽車類首選模型）。
 *
 * 每個 peer 只模擬「自己擁有的物件」（本地物理 = 零輸入延遲），
 * 固定頻率廣播自身狀態（unreliable + seq）；遠端物件收進各自的
 * SnapshotBuffer 做插值播放。peerLeave 時自動清除該 peer 的 buffer。
 */
import type { GameNetMessage, NetTransport } from '@/core/webrtc'
import { createSnapshotBuffer, type SnapshotBuffer, type SnapshotPair } from './snapshotSync'

export interface OwnershipSync<T> {
  /** 開始廣播自身狀態（getState 每次發送時呼叫） */
  start(getState: () => T): void
  /** 停止廣播並釋放（取消網路訂閱、清空遠端 buffer）；不可再 start */
  stop(): void
  /** 目前有狀態的遠端 peer（場景據此增刪代理物件） */
  remoteIds(): string[]
  /** 取某遠端的插值快照；尚無資料回 null */
  sampleRemote(peerId: string): SnapshotPair<T> | null
  /** 某遠端最新狀態（無插值） */
  latestRemote(peerId: string): T | null
}

export const createOwnershipSync = <T>(opts: {
  net: NetTransport
  /** 遊戲命名空間（= GameModule.gameId） */
  game: string
  /** 自身狀態廣播頻率，預設 20Hz */
  hz?: number
  /** 遠端插值延遲，預設 100ms */
  delayMs?: number
}): OwnershipSync<T> => {
  const { net, game, hz = 20, delayMs = 100 } = opts
  const remotes = new Map<string, SnapshotBuffer<T>>()
  let timer: ReturnType<typeof setInterval> | null = null
  let seq = 0

  const offMessage = net.on('message', (from: string, msg: GameNetMessage) => {
    if (msg.game !== game || msg.type !== 'own') return
    let buf = remotes.get(from)
    if (!buf) {
      buf = createSnapshotBuffer<T>(delayMs)
      remotes.set(from, buf)
    }
    buf.push(msg.seq ?? 0, msg.payload as T)
  })
  const offLeave = net.on('peerLeave', (peerId: string) => {
    remotes.delete(peerId)
  })

  return {
    start(getState) {
      if (timer) return
      timer = setInterval(() => {
        net.broadcastUnreliable({ game, type: 'own', seq: seq++, payload: getState() })
      }, 1000 / hz)
    },
    stop() {
      if (timer) clearInterval(timer)
      timer = null
      offMessage()
      offLeave()
      remotes.clear()
    },
    remoteIds: () => [...remotes.keys()],
    sampleRemote: (peerId) => remotes.get(peerId)?.sample() ?? null,
    latestRemote: (peerId) => remotes.get(peerId)?.latest() ?? null,
  }
}
