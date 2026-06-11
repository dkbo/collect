import { useState } from 'react'
import { Gamepad2 } from 'lucide-react'
import { GAME_CATALOG, coverUrl } from '@/babylon/games/catalog'
import type { GameType } from '@/core/room'

interface GameListProps {
  /** 點選某款遊戲 → 進入該遊戲的選單（建房 / 加入 / 單人） */
  onSelect: (game: GameType) => void
}

/** 遊戲列表：帶 AI 封面的卡片 grid，點擊後進入該遊戲選單 */
export function GameList({ onSelect }: GameListProps) {
  // 封面載入失敗時退回漸層底（避免破圖）
  const [broken, setBroken] = useState<Record<string, boolean>>({})

  return (
    <div className="max-w-3xl mx-auto" data-testid="battle-game-list">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
        {GAME_CATALOG.map((g) => (
          <button
            key={g.id}
            onClick={() => onSelect(g.id)}
            className="group text-left rounded-2xl border border-slate-800 bg-slate-900/90 overflow-hidden shadow-xl transition-all duration-300 hover:-translate-y-1 hover:border-indigo-500/60 hover:shadow-2xl cursor-pointer"
            data-testid={`battle-game-card-${g.id}`}
          >
            <div className="relative aspect-video overflow-hidden bg-gradient-to-br from-indigo-900/40 via-slate-900 to-purple-900/40">
              {!broken[g.id] && (
                <img
                  src={coverUrl(g.id)}
                  alt={g.label}
                  loading="lazy"
                  onError={() => setBroken((b) => ({ ...b, [g.id]: true }))}
                  className="size-full object-cover transition-transform duration-500 group-hover:scale-105"
                />
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-transparent to-transparent pointer-events-none" />
              <div className="absolute bottom-0 left-0 right-0 p-4">
                <h3 className="text-lg font-bold text-white drop-shadow flex items-center gap-2">
                  <Gamepad2 className="size-4 text-indigo-300" aria-hidden="true" />
                  {g.label}
                </h3>
              </div>
            </div>
            <div className="px-4 py-3">
              <p className="text-xs text-slate-400 leading-relaxed">{g.desc}</p>
            </div>
          </button>
        ))}
      </div>
    </div>
  )
}

export default GameList
