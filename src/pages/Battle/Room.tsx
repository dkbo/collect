import { useEffect, useState } from 'react'
import { Check, Copy, Crown, Gamepad2, LogOut, Send, Swords, Users, Wifi } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useRoomStore } from '@/store/useRoomStore'
import { useNetStore } from '@/store/useNetStore'
import { MAX_PLAYERS, type GameType } from '@/core/room'
import BabylonCanvas from './BabylonCanvas'

/** 對戰遊戲清單（後續擴充於此登記） */
const GAMES: { id: GameType; label: string; desc: string }[] = [
  { id: 'tank', label: '坦克對戰', desc: 'Babylon.js 2.5D・移動 + 射擊 + HP' },
  { id: 'race', label: '極速賽車', desc: '環道 3 圈衝線・WASD / 方向鍵駕駛' },
  { id: 'bomber', label: '炸彈超人', desc: '放彈炸箱拼生存・空白鍵放炸彈' },
  { id: 'overcooked', label: '廚房快手', desc: '合作做菜拼出餐・E / 空白鍵互動' },
]

/** 房間：房號分享、玩家列表、房主選遊戲/開局、離開 */
export function Room() {
  const { roomId, room, players, selfId, leave, selectGame, startGame } = useRoomStore()
  const isHost = useRoomStore((s) => s.isHost())
  const { status, openPeers, log, connect, disconnect, ping } = useNetStore()
  const transport = useNetStore((s) => s.transport)
  const [copied, setCopied] = useState(false)

  const isPlaying = room?.status === 'playing'

  // 開局後建立 WebRTC mesh（Phase 2）；對端清單以開局當下的玩家為準
  useEffect(() => {
    if (!isPlaying || !roomId || !selfId) return
    const peerIds = useRoomStore.getState().players.map((p) => p.id)
    connect(roomId, selfId, peerIds)
    return () => disconnect()
  }, [isPlaying, roomId, selfId, connect, disconnect])

  const copyCode = async () => {
    if (!roomId) return
    try {
      await navigator.clipboard.writeText(roomId)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      /* 剪貼簿不可用時忽略，使用者仍可手動讀房號 */
    }
  }

  return (
    <div className="max-w-lg mx-auto space-y-5" data-testid="battle-room">
      {/* 房號 */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 shadow-xl text-center">
        <p className="text-xs font-semibold tracking-widest text-slate-400 mb-2">房號</p>
        <button
          onClick={copyCode}
          className="group inline-flex items-center gap-3 cursor-pointer"
          aria-label="複製房號"
          data-testid="battle-room-code"
        >
          <span className="text-4xl font-extrabold font-mono tracking-[0.3em] bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent">
            {roomId}
          </span>
          {copied ? (
            <Check className="size-5 text-emerald-400" aria-hidden="true" />
          ) : (
            <Copy className="size-5 text-slate-500 group-hover:text-slate-300 transition-colors" aria-hidden="true" />
          )}
        </button>
        <p className="mt-2 text-xs text-slate-500">{copied ? '已複製！' : '點擊複製，分享給朋友加入'}</p>
      </div>

      {/* 玩家列表 */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-xl">
        <div className="flex items-center gap-2 text-sm font-semibold text-slate-300 mb-3">
          <Users className="size-4 text-indigo-400" aria-hidden="true" />
          玩家
          <span className="text-slate-500 font-normal">
            {players.length} / {MAX_PLAYERS}
          </span>
        </div>
        <ul className="space-y-2" data-testid="battle-player-list">
          {players.map((p) => (
            <li
              key={p.id}
              className="flex items-center gap-2 rounded-xl bg-slate-950/60 border border-slate-800/60 px-3 py-2.5"
            >
              <span className="flex size-7 items-center justify-center rounded-lg bg-indigo-500/15 text-indigo-300 text-xs font-bold">
                {(p.name[0] ?? '?').toUpperCase()}
              </span>
              <span className="text-slate-200 text-sm font-medium truncate">{p.name}</span>
              {p.isHost && (
                <span className="flex items-center gap-1 text-[10px] font-bold text-amber-300 bg-amber-500/10 px-1.5 py-0.5 rounded">
                  <Crown className="size-3" aria-hidden="true" />
                  房主
                </span>
              )}
              {p.id === selfId && (
                <span className="text-[10px] font-bold text-slate-400 bg-slate-700/40 px-1.5 py-0.5 rounded">你</span>
              )}
            </li>
          ))}
        </ul>
      </div>

      {/* 遊戲選擇 */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-xl">
        <div className="flex items-center gap-2 text-sm font-semibold text-slate-300 mb-3">
          <Gamepad2 className="size-4 text-purple-400" aria-hidden="true" />
          選擇遊戲
        </div>
        <div className="space-y-2">
          {GAMES.map((g) => {
            const active = room?.gameType === g.id
            return (
              <button
                key={g.id}
                onClick={() => isHost && void selectGame(g.id)}
                disabled={!isHost}
                className={`w-full text-left rounded-xl border px-4 py-3 transition-colors ${
                  active
                    ? 'border-indigo-500 bg-indigo-500/10'
                    : 'border-slate-800 bg-slate-950/40 hover:border-slate-700'
                } ${isHost ? 'cursor-pointer' : 'cursor-default'}`}
                data-testid={`battle-game-${g.id}`}
              >
                <div className="text-sm font-bold text-slate-100">{g.label}</div>
                <div className="text-xs text-slate-400">{g.desc}</div>
              </button>
            )
          })}
        </div>
        {!isHost && <p className="mt-3 text-xs text-slate-500">由房主選擇遊戲</p>}
      </div>

      {/* 開局 / 等待 */}
      {isPlaying ? (
        <div
          className="rounded-2xl border border-indigo-800/50 bg-indigo-950/30 p-5 space-y-3"
          data-testid="battle-playing"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm font-semibold text-indigo-200">
              <Wifi
                className={`size-4 ${status === 'connected' ? 'text-emerald-400' : 'text-amber-400 animate-pulse'}`}
                aria-hidden="true"
              />
              {status === 'connected' ? 'P2P 已連線' : status === 'connecting' ? '連線中…' : '單人房'}
              <span className="text-indigo-300/70 font-normal" data-testid="net-peer-count">
                {openPeers.length} / {Math.max(players.length - 1, 0)} 對端
              </span>
            </div>
            <Button
              size="sm"
              onClick={ping}
              disabled={openPeers.length === 0}
              className="h-8 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs cursor-pointer disabled:opacity-50"
              data-testid="net-ping-btn"
            >
              <Send className="size-3.5" aria-hidden="true" />
              Ping
            </Button>
          </div>

          {transport && selfId && (
            <BabylonCanvas
              gameType={room?.gameType ?? 'tank'}
              net={transport}
              selfId={selfId}
              role={isHost ? 'host' : 'guest'}
              players={players.map((p) => ({ id: p.id, name: p.name }))}
            />
          )}

          <p className="text-xs text-indigo-300/70">
            倒數結束後以 WASD / 方向鍵移動你的方塊（先點一下畫面取得焦點）；其他玩家的方塊即時同步。
          </p>

          <ul
            className="max-h-40 overflow-y-auto space-y-1 font-mono text-[11px] text-indigo-100/90"
            data-testid="net-log"
          >
            {log.length === 0 ? (
              <li className="text-indigo-300/50">尚無訊息，按 Ping 測試往返延遲</li>
            ) : (
              log.map((entry) => (
                <li key={entry.id} className="border-l-2 border-indigo-700/50 pl-2">
                  {entry.text}
                </li>
              ))
            )}
          </ul>
        </div>
      ) : isHost ? (
        <Button
          onClick={() => void startGame()}
          className="w-full h-12 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white font-bold cursor-pointer"
          data-testid="battle-start-btn"
        >
          <Swords className="size-4" aria-hidden="true" />
          開始對戰
        </Button>
      ) : (
        <div className="rounded-2xl border border-slate-800 bg-slate-900/60 px-5 py-4 text-center text-sm text-slate-400">
          等待房主開始對戰…
        </div>
      )}

      <Button
        onClick={() => void leave()}
        variant="outline"
        className="w-full h-11 rounded-xl border-slate-700 text-slate-300 bg-slate-900 hover:bg-slate-800 hover:text-white cursor-pointer"
        data-testid="battle-leave-btn"
      >
        <LogOut className="size-4" aria-hidden="true" />
        離開房間
      </Button>
    </div>
  )
}

export default Room
