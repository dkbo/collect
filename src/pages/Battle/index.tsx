import { useEffect, useState } from 'react'
import { Swords } from 'lucide-react'
import { useRoomStore } from '@/store/useRoomStore'
import type { GameType } from '@/core/room'
import GameList from './GameList'
import GameMenu from './GameMenu'
import SoloGame from './SoloGame'
import Room from './Room'

/**
 * 多人對戰頁。流程：
 * 遊戲列表（封面）→ 選遊戲後的選單（建房 / 房號加入 / 單人）→ 房間 或 單人遊玩。
 * 列表與單人不需 Firebase；建房/加入才需要（未設定時於選單提示）。
 */
export function Battle() {
  const roomId = useRoomStore((s) => s.roomId)
  const reset = useRoomStore((s) => s.reset)

  // 選單/單人為頁內狀態（沿用既有條件渲染，不新增路由）
  const [selectedGame, setSelectedGame] = useState<GameType | null>(null)
  const [solo, setSolo] = useState(false)

  // 離開頁面時取消 Firestore 訂閱（不主動離房，重整可保留身分回到大廳）
  useEffect(() => () => reset(), [reset])

  let content
  if (roomId) {
    content = <Room />
  } else if (selectedGame && solo) {
    content = <SoloGame game={selectedGame} onExit={() => setSolo(false)} />
  } else if (selectedGame) {
    content = (
      <GameMenu
        game={selectedGame}
        onBack={() => setSelectedGame(null)}
        onSolo={() => setSolo(true)}
      />
    )
  } else {
    content = <GameList onSelect={setSelectedGame} />
  }

  return (
    <div className="pb-12" data-testid="page-battle">
      <header className="text-center mb-8">
        <h1 className="text-3xl md:text-5xl font-extrabold bg-gradient-to-r from-indigo-500 via-purple-400 to-fuchsia-400 bg-clip-text text-transparent leading-tight flex items-center justify-center gap-3">
          <Swords className="size-8 md:size-10 text-indigo-400" aria-hidden="true" />
          多人對戰
        </h1>
        <p className="mt-3 text-sm md:text-base text-slate-600 dark:text-slate-400 max-w-2xl mx-auto leading-relaxed">
          選一款遊戲，單人開玩或揪 1~4 人即時連線對戰。Firebase 管房間，WebRTC 點對點傳輸，Babylon.js 渲染戰場。
        </p>
      </header>

      {content}
    </div>
  )
}

export default Battle
