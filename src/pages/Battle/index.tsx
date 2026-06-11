import { useEffect } from 'react'
import { ServerCrash, Swords } from 'lucide-react'
import { useRoomStore } from '@/store/useRoomStore'
import Lobby from './Lobby'
import Room from './Room'

/**
 * 多人對戰頁（Phase 1：控制平面）。
 * 大廳建房/加入 → 房間玩家列表 + 房主選遊戲/開局。
 * WebRTC 傳輸（Phase 2）與 Babylon.js 引擎（Phase 3+）後續接入。
 */
export function Battle() {
  const configured = useRoomStore((s) => s.configured)
  const roomId = useRoomStore((s) => s.roomId)
  const reset = useRoomStore((s) => s.reset)

  // 離開頁面時取消 Firestore 訂閱（不主動離房，重整可保留身分回到大廳）
  useEffect(() => () => reset(), [reset])

  return (
    <div className="pb-12" data-testid="page-battle">
      <header className="text-center mb-8">
        <h1 className="text-3xl md:text-5xl font-extrabold bg-gradient-to-r from-indigo-500 via-purple-400 to-fuchsia-400 bg-clip-text text-transparent leading-tight flex items-center justify-center gap-3">
          <Swords className="size-8 md:size-10 text-indigo-400" aria-hidden="true" />
          多人對戰
        </h1>
        <p className="mt-3 text-sm md:text-base text-slate-600 dark:text-slate-400 max-w-2xl mx-auto leading-relaxed">
          1~4 人即時對戰平台。Firebase 管房間與配對，WebRTC 點對點傳輸，Babylon.js 渲染戰場。
        </p>
      </header>

      {!configured ? (
        <div
          className="max-w-md mx-auto rounded-2xl border border-amber-900/40 bg-amber-950/20 p-6 text-center"
          data-testid="battle-not-configured"
        >
          <ServerCrash className="size-10 text-amber-400 mx-auto mb-3" aria-hidden="true" />
          <h2 className="text-lg font-bold text-amber-200">尚未設定 Firebase</h2>
          <p className="mt-2 text-sm text-amber-200/80 leading-relaxed">
            請於專案根目錄建立 <code className="font-mono text-amber-100">.env.local</code>，填入
            <code className="font-mono text-amber-100"> VITE_FIREBASE_* </code>
            設定（範本見 <code className="font-mono text-amber-100">.env.example</code>），重啟開發伺服器後即可使用。
          </p>
        </div>
      ) : roomId ? (
        <Room />
      ) : (
        <Lobby />
      )}
    </div>
  )
}

export default Battle
