import { useMemo, useRef } from 'react'
import { ArrowLeft, Maximize2, Minimize2 } from 'lucide-react'
import { Button, IconButton, ScreenFrame, Tag } from '@/components/toybox'
import { createNoopTransport } from '@/core/webrtc'
import { useFullscreen } from '@/lib/useFullscreen'
import { getGameMeta } from '@/babylon/games/catalog'
import type { GameType } from '@/core/room'
import BabylonCanvas from '@/pages/Battle/BabylonCanvas'

/** 暱稱持久化 key（與選單一致） */
const NAME_KEY = 'battle-name'
const SOLO_ID = 'solo'

interface SoloGameProps {
  game: GameType
  /** 結束單人、返回選單 */
  onExit: () => void
}

/**
 * 單人遊玩：以空操作傳輸層掛載 BabylonCanvas，玩家即唯一主機。
 * 不需 Firebase / WebRTC；主機權威遊戲（含倒數）單機自跑。
 */
export function SoloGame({ game, onExit }: SoloGameProps) {
  // transport 與玩家僅在掛載時建立一次，避免觸發引擎重建
  const net = useMemo(() => createNoopTransport(), [])
  const players = useMemo(
    () => [{ id: SOLO_ID, name: localStorage.getItem(NAME_KEY)?.trim() || '玩家' }],
    []
  )
  const meta = getGameMeta(game)

  const screenRef = useRef<HTMLDivElement>(null)
  const { isFullscreen, toggleFullscreen } = useFullscreen(screenRef)

  return (
    <div className="battle-solo" data-testid="battle-solo">
      <div className="battle-solo__top">
        <Button
          variant="secondary"
          size="s"
          onClick={onExit}
          icon={<ArrowLeft strokeWidth={2.5} aria-hidden="true" />}
          data-testid="battle-solo-back"
        >
          返回
        </Button>
        <Tag tone="pop" size="l">
          {meta?.label ?? game}・單人
        </Tag>
      </div>

      {/* 全螢幕時 stage 自己變 fixed，外框不動 */}
      <ScreenFrame title="NOW PLAYING" meta={`${game.toUpperCase()} · SOLO`} viewClassName="battle-view">
        <div ref={screenRef} className={isFullscreen ? 'battle-stage battle-stage--full' : 'battle-stage'}>
          <BabylonCanvas
            gameType={game}
            net={net}
            selfId={SOLO_ID}
            role="host"
            hostId={SOLO_ID}
            players={players}
          />
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

      <p className="battle-note text-center">先點一下畫面取得焦點，再以 WASD / 方向鍵操作。</p>
    </div>
  )
}

export default SoloGame
