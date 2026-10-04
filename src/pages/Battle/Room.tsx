import { useEffect, useRef, useState } from 'react'
import { AlertTriangle, Check, ChevronDown, Copy, Crown, Gamepad2, LogOut, Maximize2, Minimize2, RefreshCw, Send, Swords, Users } from 'lucide-react'
import { Button, IconBox, IconButton, ScreenFrame, StatusPill, Tag } from '@/components/toybox'
import { useRoomStore } from '@/store/useRoomStore'
import { useNetStore } from '@/store/useNetStore'
import { useFullscreen } from '@/lib/useFullscreen'
import { MAX_PLAYERS } from '@/core/room'
import { getGameMeta } from '@/babylon/games/catalog'
import BabylonCanvas from '@/pages/Battle/BabylonCanvas'

/** 玩家頭像底色：依序 sky → mint → pink → pop */
const AVATAR_TONES = ['sky', 'mint', 'pink', 'pop'] as const

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
  const gameMeta = room ? getGameMeta(room.gameType) : undefined

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

  // 房號卡（開局後縮小）
  const codeCard = (
    <div className={`battle-code${isPlaying ? ' battle-code--compact' : ''}`}>
      <span className="battle-code__eyebrow">ROOM CODE</span>
      <button
        type="button"
        onClick={copyCode}
        className="battle-code__btn"
        aria-label="複製房號"
        data-testid="battle-room-code"
      >
        <span className="battle-code__num">{roomId}</span>
        {/* 外觀同 IconButton，但不得巢狀 button */}
        <span className="tb-iconbtn" aria-hidden="true">
          {copied ? <Check strokeWidth={2.5} /> : <Copy strokeWidth={2.5} />}
        </span>
      </button>
      <p className="battle-code__hint">{copied ? '已複製！' : '點擊複製，分享給朋友加入'}</p>
    </div>
  )

  // 玩家卡：未開局列出玩家列，開局後縮成一行名字
  const playersCard = (
    <div className="battle-card">
      <div className="battle-card__head">
        <Users strokeWidth={2.5} aria-hidden="true" />
        玩家
        <span className="battle-card__count">
          {players.length} / {MAX_PLAYERS}
        </span>
      </div>
      {isPlaying ? (
        <ul className="battle-players battle-players--inline" data-testid="battle-player-list">
          {players.map((p) => (
            <li key={p.id}>{p.name}</li>
          ))}
        </ul>
      ) : (
        <ul className="battle-players" data-testid="battle-player-list">
          {players.map((p, i) => (
            <li key={p.id} className="battle-player">
              <IconBox
                tone={AVATAR_TONES[i % AVATAR_TONES.length]}
                icon={<span className="battle-player__initial">{(p.name[0] ?? '?').toUpperCase()}</span>}
              />
              <span className="battle-player__name">{p.name}</span>
              {p.isHost && (
                <Tag tone="pop" className="gap-1">
                  <Crown size={14} strokeWidth={2.5} aria-hidden="true" />
                  房主
                </Tag>
              )}
              {p.id === selfId && <Tag tone="plain">你</Tag>}
            </li>
          ))}
        </ul>
      )}
    </div>
  )

  // 遊戲卡（建房時鎖定，唯讀顯示）
  const gameCard = (
    <div className="battle-card">
      <div className="battle-card__head">
        <Gamepad2 strokeWidth={2.5} aria-hidden="true" />
        遊戲
      </div>
      {room && (
        <div className="battle-game" data-testid={`battle-game-${room.gameType}`}>
          {!isPlaying && <IconBox tone="pop" icon={<Gamepad2 strokeWidth={2.5} />} />}
          <div className="battle-game__text">
            <span className="battle-game__name">{gameMeta?.label ?? room.gameType}</span>
            {!isPlaying && <span className="battle-game__desc">{gameMeta?.desc}</span>}
          </div>
        </div>
      )}
    </div>
  )

  const leaveBtn = (
    <Button
      variant="secondary"
      onClick={() => void leave()}
      icon={<LogOut strokeWidth={2.5} aria-hidden="true" />}
      className="w-full"
      data-testid="battle-leave-btn"
    >
      離開房間
    </Button>
  )

  if (!isPlaying) {
    return (
      <div className="battle-room" data-testid="battle-room">
        <div className="battle-room__grid">
          <div className="battle-room__left">
            {codeCard}
            {playersCard}
            {gameCard}
          </div>
          <div className="battle-room__right">
            {isHost ? (
              <Button
                variant="primary"
                onClick={() => void startGame()}
                icon={<Swords strokeWidth={2.5} aria-hidden="true" />}
                className="w-full"
                data-testid="battle-start-btn"
              >
                開始對戰
              </Button>
            ) : (
              <div className="battle-wait">
                <StatusPill tone="pop">等待房主開始對戰…</StatusPill>
              </div>
            )}
            {leaveBtn}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="battle-room" data-testid="battle-room">
      <div className="battle-room" data-testid="battle-playing">
        {/* 遊戲畫面 — 盡量放大；全螢幕時 stage 自己變 fixed，外框不動 */}
        {transport && selfId && (
          <ScreenFrame
            title="NOW PLAYING"
            meta={`ROOM ${roomId ?? ''} · ${players.length}P`}
            viewClassName="battle-view"
          >
            <div ref={screenRef} className={isFullscreen ? 'battle-stage battle-stage--full' : 'battle-stage'}>
              <BabylonCanvas
                gameType={room?.gameType ?? 'tank'}
                net={transport}
                selfId={selfId}
                role={isHost ? 'host' : 'guest'}
                hostId={room?.hostId ?? selfId}
                players={players.map((p) => ({ id: p.id, name: p.name }))}
              />
              {/* 浮動全螢幕鈕 */}
              <IconButton
                label="切換全螢幕"
                className="battle-fsbtn size-9 [&_svg]:size-4"
                onClick={(e) => {
                  // 點完就交還焦點：否則空白鍵（放炸彈）會再次觸發這顆按鈕而退出全螢幕
                  e.currentTarget.blur()
                  toggleFullscreen()
                }}
                icon={isFullscreen ? <Minimize2 strokeWidth={2.5} /> : <Maximize2 strokeWidth={2.5} />}
                data-testid="battle-fullscreen-btn"
              />
            </div>
          </ScreenFrame>
        )}

        {/* 連線狀態 + Ping（橫列） */}
        <div className="battle-netbar">
          <div className="battle-netbar__status">
            <StatusPill tone={status === 'connected' ? 'success' : status === 'connecting' ? 'pop' : 'action'}>
              {status === 'connected' ? 'P2P 已連線' : status === 'connecting' ? '連線中…' : '單人房'}
            </StatusPill>
            <span className="battle-peers" data-testid="net-peer-count">
              {openPeers.length} / {Math.max(players.length - 1, 0)} <span className="battle-peers__unit">對端</span>
            </span>
          </div>
          <Button
            variant="secondary"
            size="s"
            onClick={ping}
            disabled={openPeers.length === 0}
            icon={<Send strokeWidth={2.5} aria-hidden="true" />}
            data-testid="net-ping-btn"
          >
            Ping
          </Button>
        </div>

        {connectTimedOut && (
          <div className="battle-alert battle-alert--error battle-alert--action" data-testid="net-connect-timeout">
            <AlertTriangle strokeWidth={2.5} aria-hidden="true" />
            <span className="battle-alert__text">連線逾時，請確認網路後重試</span>
            <Button
              variant="secondary"
              size="s"
              onClick={retryConnect}
              icon={<RefreshCw strokeWidth={2.5} aria-hidden="true" />}
              data-testid="net-retry-btn"
            >
              重試
            </Button>
          </div>
        )}

        <p className="battle-note">WASD / 方向鍵操作（先點一下畫面取得焦點），手機用虛擬搖桿與動作鈕。</p>

        {/* 網路 log（可收合） */}
        <details>
          <summary className="battle-log__summary">
            網路訊息 ({log.length})
            <ChevronDown strokeWidth={2.5} aria-hidden="true" />
          </summary>
          <ul className="battle-log__list" data-testid="net-log">
            {log.length === 0 ? (
              <li>尚無訊息</li>
            ) : (
              log.map((entry) => (
                <li key={entry.id} className="battle-log__item">
                  {entry.text}
                </li>
              ))
            )}
          </ul>
        </details>

        <div className="battle-room__cards">
          {codeCard}
          {playersCard}
          {gameCard}
        </div>
      </div>

      {leaveBtn}
    </div>
  )
}

export default Room
