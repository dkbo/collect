import { useMemo, useRef } from 'react'
import { ArrowLeft, Maximize2, Minimize2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { createNoopTransport } from '@/core/webrtc'
import { useFullscreen } from '@/lib/useFullscreen'
import { getGameMeta } from '@/babylon/games/catalog'
import type { GameType } from '@/core/room'
import BabylonCanvas from './BabylonCanvas'

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
    <div className="space-y-4" data-testid="battle-solo">
      <div className="flex items-center justify-between">
        <button
          onClick={onExit}
          className="inline-flex items-center gap-1.5 text-sm text-slate-400 hover:text-slate-200 transition-colors cursor-pointer"
          data-testid="battle-solo-back"
        >
          <ArrowLeft className="size-4" aria-hidden="true" />
          返回
        </button>
        <div className="text-sm font-bold text-slate-200">{meta?.label ?? game}・單人</div>
      </div>

      <div
        ref={screenRef}
        className={
          isFullscreen
            ? 'fixed inset-0 z-50 w-screen h-dvh bg-black'
            : 'relative w-full rounded-2xl overflow-hidden border border-slate-800 shadow-xl h-[75dvh] sm:h-[80dvh]'
        }
      >
        <BabylonCanvas
          gameType={game}
          net={net}
          selfId={SOLO_ID}
          role="host"
          hostId={SOLO_ID}
          players={players}
        />
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

      <p className="text-xs text-slate-500 text-center">
        先點一下畫面取得焦點，再以 WASD / 方向鍵操作。
      </p>
    </div>
  )
}

export default SoloGame
