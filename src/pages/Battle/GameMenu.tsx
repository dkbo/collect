import { useEffect, useState } from 'react'
import { AlertTriangle, ArrowLeft, Info, LogIn, Plus, User } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useRoomStore } from '@/store/useRoomStore'
import { getGameMeta, coverUrl } from '@/babylon/games/catalog'
import type { GameType } from '@/core/room'

/** 暱稱持久化 key（與舊大廳一致） */
const NAME_KEY = 'battle-name'

const inputClass =
  'w-full h-11 px-4 rounded-xl bg-slate-950 border border-slate-700 text-slate-100 placeholder:text-slate-500 ' +
  'focus:outline-none focus:ring-2 focus:ring-indigo-500/60 focus:border-indigo-500 transition-colors'

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
    <div className="max-w-md mx-auto" data-testid="battle-game-menu">
      <button
        onClick={onBack}
        className="mb-4 inline-flex items-center gap-1.5 text-sm text-slate-400 hover:text-slate-200 transition-colors cursor-pointer"
        data-testid="battle-menu-back"
      >
        <ArrowLeft className="size-4" aria-hidden="true" />
        返回遊戲列表
      </button>

      {/* 所選遊戲封面 */}
      <div className="relative aspect-video rounded-2xl overflow-hidden border border-slate-800 shadow-xl bg-gradient-to-br from-indigo-900/40 via-slate-900 to-purple-900/40 mb-5">
        {!broken && (
          <img
            src={coverUrl(game)}
            alt={meta?.label ?? game}
            onError={() => setBroken(true)}
            className="size-full object-cover"
          />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-slate-950/85 via-slate-950/20 to-transparent pointer-events-none" />
        <div className="absolute bottom-0 left-0 right-0 p-4">
          <h2 className="text-xl font-bold text-white drop-shadow">{meta?.label ?? game}</h2>
          <p className="text-xs text-slate-300/90 mt-0.5">{meta?.desc}</p>
        </div>
      </div>

      {notice && (
        <div className="mb-4 flex items-center gap-2 rounded-xl border border-amber-900/40 bg-amber-950/30 px-4 py-3 text-sm text-amber-200">
          <Info className="size-4 shrink-0" aria-hidden="true" />
          {notice}
        </div>
      )}

      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-5">
        <div className="space-y-2">
          <label htmlFor="battle-name" className="text-xs font-semibold tracking-wider text-slate-400">
            你的暱稱
          </label>
          <input
            id="battle-name"
            className={inputClass}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="輸入暱稱（選填）"
            maxLength={16}
            data-testid="battle-name-input"
          />
        </div>

        {/* 單人遊玩（不需 Firebase） */}
        <Button
          onClick={onSolo}
          className="w-full h-11 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-bold cursor-pointer"
          data-testid="battle-solo-btn"
        >
          <User className="size-4" aria-hidden="true" />
          單人遊玩
        </Button>

        <div className="flex items-center gap-3 text-xs text-slate-500 select-none">
          <span className="h-px flex-1 bg-slate-800" />
          或揪人連線對戰
          <span className="h-px flex-1 bg-slate-800" />
        </div>

        {!configured && (
          <div
            className="flex items-center gap-2 rounded-xl border border-amber-900/40 bg-amber-950/20 px-4 py-3 text-xs text-amber-200/90"
            data-testid="battle-not-configured"
          >
            <AlertTriangle className="size-4 shrink-0" aria-hidden="true" />
            尚未設定 Firebase，無法建立 / 加入房間；單人遊玩不受影響。
          </div>
        )}

        <Button
          onClick={handleCreate}
          disabled={busy || !configured}
          className="w-full h-11 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white font-bold cursor-pointer disabled:opacity-60"
          data-testid="battle-create-btn"
        >
          <Plus className="size-4" aria-hidden="true" />
          建立房間
        </Button>

        <div className="flex gap-2">
          <input
            className={inputClass + ' uppercase tracking-[0.3em] font-mono text-center'}
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
            onClick={handleJoin}
            disabled={busy || !configured || !code.trim()}
            variant="outline"
            className="h-11 px-5 rounded-xl border-slate-700 text-slate-200 bg-slate-900 hover:bg-slate-800 hover:text-white cursor-pointer disabled:opacity-60 shrink-0"
            data-testid="battle-join-btn"
          >
            <LogIn className="size-4" aria-hidden="true" />
            加入
          </Button>
        </div>

        {error && (
          <div
            className="flex items-center gap-2 rounded-xl border border-rose-900/40 bg-rose-950/30 px-4 py-3 text-sm text-rose-300"
            data-testid="battle-error"
          >
            <AlertTriangle className="size-4 shrink-0" aria-hidden="true" />
            {error}
          </div>
        )}
      </div>

      <p className="mt-5 text-center text-xs text-slate-500">
        建立房間後將房號分享給朋友，最多 4 人同場；或直接單人遊玩。
      </p>
    </div>
  )
}

export default GameMenu
