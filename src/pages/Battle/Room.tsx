import { useEffect, useRef, useState } from 'react'
import { AlertTriangle, Check, Copy, Crown, Gamepad2, LogOut, Maximize2, Minimize2, RefreshCw, Send, Swords, Users, Wifi } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useRoomStore } from '@/store/useRoomStore'
import { useNetStore } from '@/store/useNetStore'
import { useFullscreen } from '@/lib/useFullscreen'
import { MAX_PLAYERS } from '@/core/room'
import { getGameMeta } from '@/babylon/games/catalog'
import BabylonCanvas from './BabylonCanvas'

/** 房間：房號分享、玩家列表、開局/等待、離開（遊戲於建房時鎖定） */
export function Room() {
  const { roomId, room, players, selfId, leave, startGame } = useRoomStore()
  const isHost = useRoomStore((s) => s.isHost())
  const { status, openPeers, log, connectTimedOut, connect, disconnect, ping, syncPeers } = useNetStore()
  const transport = useNetStore((s) => s.transport)
  const [copied, setCopied] = useState(false)

  // 全螢幕：原生 API 不可用（iPhone Safari）時自動 fallback 成 CSS 偽全螢幕
  const screenRef = useRef<HTMLDivElement>(null)
  const { isFullscreen, toggleFullscreen } = useFullscreen(screenRef)

  const isPlaying = room?.status === 'playing'

  // 開局後建立 WebRTC mesh（Phase 2）；對端清單以開局當下的玩家為準
  useEffect(() => {
    if (!isPlaying || !roomId || !selfId) return
    const peerIds = useRoomStore.getState().players.map((p) => p.id)
    connect(roomId, selfId, peerIds)
    return () => disconnect()
  }, [isPlaying, roomId, selfId, connect, disconnect])

  // 中途加入者：開局後玩家名單變動（新玩家加入/離開）同步給 mesh，補連/斷線
  useEffect(() => {
    if (!isPlaying || !selfId) return
    syncPeers(players.map((p) => p.id).filter((id) => id !== selfId))
  }, [isPlaying, selfId, players, syncPeers])

  const retryConnect = () => {
    if (!roomId || !selfId) return
    disconnect()
    const peerIds = useRoomStore.getState().players.map((p) => p.id)
    connect(roomId, selfId, peerIds)
  }

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
    <div className="space-y-5" data-testid="battle-room">
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

      {/* 遊戲（建房時鎖定，唯讀顯示） */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-xl">
        <div className="flex items-center gap-2 text-sm font-semibold text-slate-300 mb-3">
          <Gamepad2 className="size-4 text-purple-400" aria-hidden="true" />
          遊戲
        </div>
        {room && (
          <div
            className="rounded-xl border border-indigo-500/60 bg-indigo-500/10 px-4 py-3"
            data-testid={`battle-game-${room.gameType}`}
          >
            <div className="text-sm font-bold text-slate-100">
              {getGameMeta(room.gameType)?.label ?? room.gameType}
            </div>
            <div className="text-xs text-slate-400">{getGameMeta(room.gameType)?.desc}</div>
          </div>
        )}
      </div>

      {/* 開局 / 等待 */}
      {isPlaying ? (
        <div
          className="space-y-3"
          data-testid="battle-playing"
        >
          {/* 遊戲畫面 — 盡量放大 */}
          {transport && selfId && (
            <div
              ref={screenRef}
              className={
                isFullscreen
                  ? 'fixed inset-0 z-50 w-screen h-dvh bg-black'
                  : 'relative w-full overflow-hidden rounded-2xl border border-slate-800 shadow-xl h-[75dvh] sm:h-[80dvh]'
              }
            >
              <BabylonCanvas
                gameType={room?.gameType ?? 'tank'}
                net={transport}
                selfId={selfId}
                role={isHost ? 'host' : 'guest'}
                hostId={room?.hostId ?? selfId}
                players={players.map((p) => ({ id: p.id, name: p.name }))}
              />
              {/* 浮動全螢幕鈕 */}
              <Button
                variant="outline"
                size="icon"
                className="absolute z-10 size-9 rounded-xl border-slate-700 text-slate-400 bg-slate-900/80 hover:bg-slate-800 hover:text-white cursor-pointer backdrop-blur-sm shadow-md top-[max(0.5rem,env(safe-area-inset-top))] right-[max(0.5rem,env(safe-area-inset-right))]"
                onClick={toggleFullscreen}
                aria-label="切換全螢幕"
                data-testid="battle-fullscreen-btn"
              >
                {isFullscreen ? <Minimize2 className="size-4" /> : <Maximize2 className="size-4" />}
              </Button>
            </div>
          )}

          {/* 連線狀態 + 操作說明（橫列） */}
          <div className="flex items-center justify-between gap-3 flex-wrap">
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
            <div className="flex items-center gap-2">
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
          </div>

          {connectTimedOut && (
            <div
              className="flex items-center justify-between gap-3 flex-wrap rounded-xl border border-rose-800/60 bg-rose-950/40 px-4 py-3"
              data-testid="net-connect-timeout"
            >
              <div className="flex items-center gap-2 text-sm font-semibold text-rose-300">
                <AlertTriangle className="size-4" aria-hidden="true" />
                連線逾時，請確認網路後重試
              </div>
              <Button
                size="sm"
                onClick={retryConnect}
                className="h-8 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-xs cursor-pointer"
                data-testid="net-retry-btn"
              >
                <RefreshCw className="size-3.5" aria-hidden="true" />
                重試
              </Button>
            </div>
          )}

          <p className="text-xs text-indigo-300/70">
            WASD / 方向鍵操作（先點一下畫面取得焦點），手機用虛擬搖桿與動作鈕。
          </p>

          {/* 網路 log（可收合） */}
          <details className="group">
            <summary className="text-xs text-indigo-300/50 cursor-pointer hover:text-indigo-300/80 transition-colors">
              網路訊息 ({log.length})
            </summary>
            <ul
              className="max-h-32 overflow-y-auto space-y-1 font-mono text-[11px] text-indigo-100/90 mt-2"
              data-testid="net-log"
            >
              {log.length === 0 ? (
                <li className="text-indigo-300/50">尚無訊息</li>
              ) : (
                log.map((entry) => (
                  <li key={entry.id} className="border-l-2 border-indigo-700/50 pl-2">
                    {entry.text}
                  </li>
                ))
              )}
            </ul>
          </details>
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
