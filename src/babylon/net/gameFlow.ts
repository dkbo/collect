/**
 * 共用對局流程狀態機（Phase A 工具層）：
 * lobby → countdown → playing → result →（reset 回 lobby 再來一局）。
 *
 * Host 為唯一驅動者：startCountdown / endGame / reset 僅 host 可呼叫，
 * 轉換經 reliable 廣播（type 'flow'），guest 收到後套用本地狀態。
 * 倒數以「收到訊息當下 + durationMs」本地計時（P2P 延遲低，誤差可忽略）。
 */
import type { GameNetMessage, NetTransport } from '@/core/webrtc'

export type FlowPhase = 'lobby' | 'countdown' | 'playing' | 'result'

export interface FlowState {
  phase: FlowPhase
  /** result 階段的結算資料（host 於 endGame 時帶入，如積分榜） */
  result?: unknown
}

export interface GameFlow {
  readonly state: FlowState
  /** 訂閱狀態變更；回傳取消函式 */
  onChange(cb: (state: FlowState) => void): () => void
  /** countdown 階段剩餘毫秒；其他階段回 0 */
  countdownRemaining(): number
  /** host：開始倒數（結束後自動進 playing 並廣播） */
  startCountdown(seconds?: number): void
  /** host：結束對局進 result，result 廣播給全員 */
  endGame(result?: unknown): void
  /** host：回 lobby（再來一局） */
  reset(): void
  /** 釋放（取消網路訂閱與計時器） */
  dispose(): void
}

interface FlowPayload {
  phase: FlowPhase
  durationMs?: number
  result?: unknown
}

export const createGameFlow = (opts: {
  net: NetTransport
  /** 遊戲命名空間（= GameModule.gameId） */
  game: string
  role: 'host' | 'guest'
}): GameFlow => {
  const { net, game, role } = opts
  let state: FlowState = { phase: 'lobby' }
  let countdownEndsAt = 0
  let countdownTimer: ReturnType<typeof setTimeout> | null = null
  const listeners = new Set<(s: FlowState) => void>()

  const setState = (next: FlowState) => {
    state = next
    listeners.forEach((cb) => cb(state))
  }

  const clearCountdown = () => {
    if (countdownTimer) clearTimeout(countdownTimer)
    countdownTimer = null
  }

  const apply = (p: FlowPayload) => {
    clearCountdown()
    if (p.phase === 'countdown') {
      const ms = p.durationMs ?? 3000
      countdownEndsAt = performance.now() + ms
      // host 倒數結束後廣播 playing；guest 也本地切換（host 廣播為權威補正）
      countdownTimer = setTimeout(() => {
        if (role === 'host') transition({ phase: 'playing' })
        else setState({ phase: 'playing' })
      }, ms)
    }
    setState({ phase: p.phase, result: p.result })
  }

  /** host 專用：本地套用 + 廣播 */
  const transition = (p: FlowPayload) => {
    if (role !== 'host') return
    net.broadcast({ game, type: 'flow', payload: p })
    apply(p)
  }

  const offMessage = net.on('message', (_from: string, msg: GameNetMessage) => {
    if (msg.game !== game || msg.type !== 'flow' || role === 'host') return
    apply(msg.payload as FlowPayload)
  })

  // 開局當下 guest 的 DataChannel 可能尚未開啟，broadcast 會漏接；
  // host 在每條通道開啟時對該 peer 補送當前狀態（countdown 帶剩餘毫秒）。
  const offOpen =
    role === 'host'
      ? net.on('open', (peerId: string) => {
          if (state.phase === 'lobby') return
          const p: FlowPayload =
            state.phase === 'countdown'
              ? { phase: 'countdown', durationMs: Math.max(0, countdownEndsAt - performance.now()) }
              : { phase: state.phase, result: state.result }
          net.send(peerId, { game, type: 'flow', payload: p })
        })
      : null

  return {
    get state() {
      return state
    },
    onChange(cb) {
      listeners.add(cb)
      return () => listeners.delete(cb)
    },
    countdownRemaining: () =>
      state.phase === 'countdown' ? Math.max(0, countdownEndsAt - performance.now()) : 0,
    startCountdown: (seconds = 3) =>
      transition({ phase: 'countdown', durationMs: seconds * 1000 }),
    endGame: (result) => transition({ phase: 'result', result }),
    reset: () => transition({ phase: 'lobby' }),
    dispose() {
      clearCountdown()
      offMessage()
      offOpen?.()
      listeners.clear()
    },
  }
}
