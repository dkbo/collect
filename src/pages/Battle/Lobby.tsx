import { useEffect, useState } from 'react'
import { AlertTriangle, Info, LogIn, Plus, Swords } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useRoomStore } from '@/store/useRoomStore'

/** 暱稱持久化 key */
const NAME_KEY = 'battle-name'

const inputClass =
  'w-full h-11 px-4 rounded-xl bg-slate-950 border border-slate-700 text-slate-100 placeholder:text-slate-500 ' +
  'focus:outline-none focus:ring-2 focus:ring-indigo-500/60 focus:border-indigo-500 transition-colors'

/** 大廳：設定暱稱、建立房間或以房號加入 */
export function Lobby() {
  const { busy, error, notice, create, join, clearError } = useRoomStore()
  const [name, setName] = useState(() => localStorage.getItem(NAME_KEY) ?? '')
  const [code, setCode] = useState('')

  useEffect(() => {
    localStorage.setItem(NAME_KEY, name)
  }, [name])

  const handleCreate = () => {
    clearError()
    void create(name)
  }

  const handleJoin = () => {
    if (!code.trim()) return
    clearError()
    void join(code, name)
  }

  return (
    <div className="max-w-md mx-auto" data-testid="battle-lobby">
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

        <Button
          onClick={handleCreate}
          disabled={busy}
          className="w-full h-11 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white font-bold cursor-pointer disabled:opacity-60"
          data-testid="battle-create-btn"
        >
          <Plus className="size-4" aria-hidden="true" />
          建立房間
        </Button>

        <div className="flex items-center gap-3 text-xs text-slate-500 select-none">
          <span className="h-px flex-1 bg-slate-800" />
          或加入現有房間
          <span className="h-px flex-1 bg-slate-800" />
        </div>

        <div className="flex gap-2">
          <input
            className={inputClass + ' uppercase tracking-[0.3em] font-mono text-center'}
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            onKeyDown={(e) => e.key === 'Enter' && handleJoin()}
            placeholder="房號"
            maxLength={6}
            aria-label="房號"
            data-testid="battle-code-input"
          />
          <Button
            onClick={handleJoin}
            disabled={busy || !code.trim()}
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

      <p className="mt-5 flex items-center justify-center gap-1.5 text-xs text-slate-500">
        <Swords className="size-3.5" aria-hidden="true" />
        建立後將房號分享給朋友，最多 4 人同場對戰
      </p>
    </div>
  )
}

export default Lobby
