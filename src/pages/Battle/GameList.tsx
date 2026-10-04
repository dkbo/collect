import { useState } from 'react'
import { GAME_CATALOG, coverUrl } from '@/babylon/games/catalog'
import type { GameType } from '@/core/room'

interface GameListProps {
  /** 點選某款遊戲 → 進入該遊戲的選單（建房 / 加入 / 單人） */
  onSelect: (game: GameType) => void
}

/** 遊戲列表：CartridgeCard 外觀的卡帶 grid（點選是頁內狀態，故用 button 而非連結） */
export function GameList({ onSelect }: GameListProps) {
  // 封面載入失敗時改顯示 NO SIGNAL（避免破圖）
  const [broken, setBroken] = useState<Record<string, boolean>>({})

  return (
    <div className="battle-list" data-testid="battle-game-list">
      {GAME_CATALOG.map((g, i) => (
        <button
          key={g.id}
          type="button"
          onClick={() => onSelect(g.id)}
          className="tb-card tb-lift"
          data-testid={`battle-game-card-${g.id}`}
        >
          <span className="tb-card__strip">
            <span>No.{String(i + 1).padStart(2, '0')}</span>
            <span>2-4P ▸</span>
          </span>
          {broken[g.id] ? (
            <span className="battle-nosignal battle-list__nosignal">NO SIGNAL</span>
          ) : (
            <img
              src={coverUrl(g.id)}
              alt={g.label}
              loading="lazy"
              decoding="async"
              onError={() => setBroken((b) => ({ ...b, [g.id]: true }))}
              className="tb-card__media"
            />
          )}
          <span className="tb-card__body">
            <span className="tb-card__title">{g.label}</span>
            <span className="tb-card__desc">{g.desc}</span>
          </span>
        </button>
      ))}
    </div>
  )
}

export default GameList
