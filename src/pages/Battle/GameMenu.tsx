import { useEffect, useState } from 'react'
import { AlertTriangle, ArrowLeft, Info, LogIn, Plus, User } from 'lucide-react'
import { Button } from '@/components/toybox'
import { useRoomStore } from '@/store/useRoomStore'
import { GAME_CATALOG, getGameMeta, coverUrl } from '@/babylon/games/catalog'
import type { GameType } from '@/core/room'

/** 暱稱持久化 key（與舊大廳一致） */
const NAME_KEY = 'battle-name'

interface GameMenuProps {
  game: GameType
  /** 返回遊戲列表 */
  onBack: () => void
  /** 開始單人遊玩（不需 Firebase / 連線） */
  onSolo: () => void
}

/** 遊戲選單：所選遊戲的封面 + 暱稱 + 建立房間 / 房號加入 / 單人遊玩 */
export function GameMenu({ game, onBack, onSolo }: GameMenuProps) {
  const { configured, busy, error, notice, create, join, clearError } = useRoomStore()
  const [name, setName] = useState(() => localStorage.getItem(NAME_KEY) ?? '')
  const [code, setCode] = useState('')
  const meta = getGameMeta(game)
  const no = String(GAME_CATALOG.findIndex((g) => g.id === game) + 1).padStart(2, '0')
  const [broken, setBroken] = useState(false)

  useEffect(() => {
    localStorage.setItem(NAME_KEY, name)
  }, [name])

  const handleCreate = () => {
    clearError()
    void create(name, game)
  }

  const handleJoin = () => {
    if (!code.trim()) return
    clearError()
    void join(code, name)
  }

  return (
    <div className="battle-menu" data-testid="battle-game-menu">
      <Button
        variant="secondary"
        size="s"
        onClick={onBack}
        icon={<ArrowLeft strokeWidth={2.5} aria-hidden="true" />}
        className="self-start"
        data-testid="battle-menu-back"
      >
        返回遊戲列表
      </Button>

      {notice && (
        <div className="battle-alert battle-alert--info">
          <Info strokeWidth={2.5} aria-hidden="true" />
          <span className="battle-alert__text">{notice}</span>
        </div>
      )}

      <div className="battle-menu__grid">
        {/* 所選遊戲封面 */}
        <div className="battle-cover">
          {broken ? (
            <span className="battle-nosignal battle-cover__nosignal">NO SIGNAL</span>
          ) : (
            <img
              src={coverUrl(game)}
              alt={meta?.label ?? game}
              onError={() => setBroken(true)}
              className="battle-cover__img"
            />
          )}
          <div className="battle-cover__panel">
            <span className="battle-cover__meta">No.{no} · 1-4P</span>
            <h2 className="battle-cover__title">{meta?.label ?? game}</h2>
            <p className="battle-cover__desc">{meta?.desc}</p>
          </div>
        </div>

        <div className="battle-menu__side">
          <div className="battle-panel">
            <div className="battle-field">
              <label htmlFor="battle-name" className="battle-label">
                你的暱稱
              </label>
              <input
                id="battle-name"
                className="tb-input"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="輸入暱稱（選填）"
                maxLength={16}
                data-testid="battle-name-input"
              />
            </div>

            {/* 單人遊玩（不需 Firebase）：本畫面唯一的 primary */}
            <Button
              variant="primary"
              onClick={onSolo}
              icon={<User strokeWidth={2.5} aria-hidden="true" />}
              className="w-full"
              data-testid="battle-solo-btn"
            >
              單人遊玩
            </Button>

            <div className="battle-divider">或揪人連線對戰</div>

            {!configured && (
              <div className="battle-alert battle-alert--warn" data-testid="battle-not-configured">
                <AlertTriangle strokeWidth={2.5} aria-hidden="true" />
                <span className="battle-alert__text">尚未設定 Firebase，無法建立 / 加入房間；單人遊玩不受影響。</span>
              </div>
            )}

            <Button
              variant="ink"
              onClick={handleCreate}
              disabled={busy || !configured}
              icon={<Plus strokeWidth={2.5} aria-hidden="true" />}
              className="w-full"
              data-testid="battle-create-btn"
            >
              建立房間
            </Button>

            <div className="battle-inline">
              <input
                className="tb-input flex-1 text-center font-pixel text-pixel-l tracking-widest uppercase"
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                onKeyDown={(e) => e.key === 'Enter' && handleJoin()}
                placeholder="房號"
                maxLength={6}
                aria-label="房號"
                disabled={!configured}
                data-testid="battle-code-input"
              />
              <Button
                variant="secondary"
                size="s"
                onClick={handleJoin}
                disabled={busy || !configured || !code.trim()}
                icon={<LogIn strokeWidth={2.5} aria-hidden="true" />}
                data-testid="battle-join-btn"
              >
                加入
              </Button>
            </div>

            {error && (
              <div className="battle-alert battle-alert--error" data-testid="battle-error">
                <AlertTriangle strokeWidth={2.5} aria-hidden="true" />
                <span className="battle-alert__text">{error}</span>
              </div>
            )}
          </div>

          <p className="battle-note battle-menu__foot">建立房間後將房號分享給朋友，最多 4 人同場；或直接單人遊玩。</p>
        </div>
      </div>
    </div>
  )
}

export default GameMenu
