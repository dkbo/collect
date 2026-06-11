import { create } from 'zustand'
import { createMesh, type GameNetMessage, type Mesh, type NetTransport } from '@/core/webrtc'

/** ping demo 系統訊息命名空間（Phase 2 連線驗證用，Phase 4 換成實際遊戲訊息） */
const SYS = '_sys'

export type NetStatus = 'idle' | 'connecting' | 'connected'

export interface NetLogEntry {
  id: number
  text: string
}

interface NetStore {
  status: NetStatus
  /** DataChannel 已開啟的對端 uid */
  openPeers: string[]
  /** ping/pong 往返紀錄（最新在前） */
  log: NetLogEntry[]
  /** 連線中的傳輸層；供 Babylon 遊戲取用（無連線時為 null） */
  transport: NetTransport | null

  connect: (roomId: string, selfId: string, peerIds: string[]) => void
  disconnect: () => void
  /** 向所有對端廣播一則 ping，收到回傳的 pong 後記錄 RTT */
  ping: () => void
}

// mesh 與 selfId 留模組層級（非反應式）
let mesh: Mesh | null = null
let self = ''
let unsubs: Array<() => void> = []
let logSeq = 0

const initialState = {
  status: 'idle' as NetStatus,
  openPeers: [] as string[],
  log: [] as NetLogEntry[],
  transport: null as NetTransport | null,
}

export const useNetStore = create<NetStore>((set, get) => {
  const addLog = (text: string) =>
    set({ log: [{ id: logSeq++, text }, ...get().log].slice(0, 20) })

  const teardown = () => {
    unsubs.forEach((u) => u())
    unsubs = []
    mesh?.stop()
    mesh = null
  }

  return {
    ...initialState,

    connect: (roomId, selfId, peerIds) => {
      teardown()
      self = selfId
      set({ ...initialState, status: peerIds.length > 1 ? 'connecting' : 'connected' })

      const m = createMesh({ roomId, selfId, peerIds })
      mesh = m
      set({ transport: m })

      unsubs.push(
        m.on('open', (peerId) => {
          if (get().openPeers.includes(peerId)) return
          set({ openPeers: [...get().openPeers, peerId], status: 'connected' })
          addLog(`已連線：${peerId.slice(0, 6)}`)
        }),
        m.on('close', (peerId) => {
          set({ openPeers: get().openPeers.filter((p) => p !== peerId) })
        }),
        m.on('message', (from, msg: GameNetMessage) => {
          if (msg.game !== SYS) return
          const p = msg.payload as { from: string; t: number }
          if (msg.type === 'ping') {
            // 回傳 pong（帶回原時間戳供對方算 RTT）
            mesh?.send(from, { game: SYS, type: 'pong', payload: { from: self, t: p.t } })
          } else if (msg.type === 'pong') {
            addLog(`pong ← ${from.slice(0, 6)}（RTT ${Date.now() - p.t} ms）`)
          }
        })
      )

      m.start()
    },

    disconnect: () => {
      teardown()
      set({ ...initialState })
    },

    ping: () => {
      if (!mesh) return
      mesh.broadcast({ game: SYS, type: 'ping', payload: { from: self, t: Date.now() } })
      addLog('ping → 全體')
    },
  }
})

export default useNetStore
