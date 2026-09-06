import { useEffect, useMemo, useRef, useState } from 'react'
import { ArcRotateCamera, Engine, Scene } from '@babylonjs/core'
import { RotateCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { NetTransport } from '@/core/webrtc'
import type { GameOverlay, GamePlayer } from '@/babylon/types'
import { getGameFactory } from '@/babylon/games'
import type { GameType } from '@/core/room'
import { TouchControls, type TouchAction } from './TouchControls'

interface BabylonCanvasProps {
  gameType: GameType
  net: NetTransport
  selfId: string
  role: 'host' | 'guest'
  /** 房主 uid：遊戲層據此過濾非房主的權威訊息 */
  hostId: string
  players: GamePlayer[]
}

/**
 * 各遊戲的行動裝置動作鈕（移動一律由虛擬搖桿 → 方向鍵）。
 * key 對應遊戲端 e.key.toLowerCase() 後的比對值。
 */
const TOUCH_ACTIONS: Record<GameType, TouchAction[]> = {
  tank: [{ label: '🔥', key: ' ' }],
  race: [],
  bomber: [
    { label: '💣', key: ' ' },
    { label: '🧤', key: 'f' },
  ],
  overcooked: [{ label: '✋', key: 'e' }],
}

/**
 * Babylon 引擎掛載點（計畫 §2）。負責 Engine/Scene 生命週期、
 * 依 gameType 實例化 GameModule、把 NetTransport 訊息轉進場景、跑 render loop，
 * 卸載時依序釋放所有資源。遊戲本身與網路同處 JS context，無 iframe/postMessage。
 */
export function BabylonCanvas({ gameType, net, selfId, role, hostId, players }: BabylonCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [overlay, setOverlay] = useState<GameOverlay | null>(null)
  // 觸控為主的裝置（手機/平板）才顯示虛擬搖桿與動作鈕
  const isTouch = useMemo(() => window.matchMedia?.('(pointer: coarse)')?.matches ?? false, [])
  // 觸控裝置強制橫向：直向時以提示蓋住遊戲，並嘗試原生鎖定方向
  const [portrait, setPortrait] = useState(false)
  // players 走 ref，避免列表變動觸發引擎重建（init 只在掛載時讀一次初始值）
  const playersRef = useRef(players)
  useEffect(() => {
    playersRef.current = players
  }, [players])

  // 強制橫向：偵測直向狀態 + 盡力呼叫 Screen Orientation API 鎖定橫向
  // （Android 全螢幕下有效；iOS Safari 無此 API，改由直向提示層確保橫向遊玩）
  useEffect(() => {
    if (!isTouch) return
    const lockLandscape = () => {
      const o = screen.orientation as
        | (ScreenOrientation & { lock?: (orientation: string) => Promise<void> })
        | undefined
      o?.lock?.('landscape').catch(() => {
        /* 非全螢幕或不支援時會拒絕，交由直向提示層處理 */
      })
    }
    const mq = window.matchMedia('(orientation: portrait)')
    const update = () => setPortrait(mq.matches)
    update()
    lockLandscape()
    mq.addEventListener('change', update)
    // 進入全螢幕後才能成功鎖定，故 fullscreenchange 時重試
    document.addEventListener('fullscreenchange', lockLandscape)
    return () => {
      mq.removeEventListener('change', update)
      document.removeEventListener('fullscreenchange', lockLandscape)
    }
  }, [isTouch])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const engine = new Engine(canvas, true, { preserveDrawingBuffer: true, stencil: true })
    const scene = new Scene(engine)
    const game = getGameFactory(gameType)()
    game.init({ scene, net, selfId, role, hostId, players: playersRef.current, setOverlay })

    const offMessage = net.on('message', (from, msg) => game.onNetworkMessage(from, msg))

    // 遊戲操作鍵（空白鍵/方向鍵）在 canvas 聚焦時不可觸發頁面捲動
    const SCROLL_KEYS = [' ', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight']
    const blockScrollKeys = (e: KeyboardEvent) => {
      if (SCROLL_KEYS.includes(e.key)) e.preventDefault()
    }
    canvas.addEventListener('keydown', blockScrollKeys)

    // 視角自適應：遊戲相機以 16:9 橫向構圖調校，畫面比這窄（手機直向）時拉遠
    // ArcRotateCamera 半徑，讓場景水平方向不被裁切、完整塞進可視空間。
    const DESIGN_ASPECT = 16 / 9
    const baseRadii = new WeakMap<ArcRotateCamera, number>()
    const fitCameras = () => {
      const w = engine.getRenderWidth()
      const h = engine.getRenderHeight()
      if (w === 0 || h === 0) return
      const aspect = w / h
      for (const cam of scene.cameras) {
        if (!(cam instanceof ArcRotateCamera)) continue
        let base = baseRadii.get(cam)
        if (base === undefined) {
          base = cam.radius
          baseRadii.set(cam, base)
        }
        cam.radius = aspect < DESIGN_ASPECT ? base * (DESIGN_ASPECT / aspect) : base
      }
    }
    fitCameras()

    engine.runRenderLoop(() => {
      game.update(engine.getDeltaTime())
      scene.render()
      // 驗證用：曝露就緒旗標與場景物件數
      ;(window as unknown as Record<string, unknown>).__BATTLE_READY = true
      ;(window as unknown as Record<string, unknown>).__BATTLE_MESHES = scene.meshes.length
    })

    const resize = () => {
      engine.resize()
      fitCameras()
    }
    window.addEventListener('resize', resize)
    const ro = new ResizeObserver(resize)
    ro.observe(canvas)

    return () => {
      ro.disconnect()
      window.removeEventListener('resize', resize)
      canvas.removeEventListener('keydown', blockScrollKeys)
      offMessage()
      engine.stopRenderLoop()
      game.dispose()
      scene.dispose()
      engine.dispose()
      setOverlay(null)
      ;(window as unknown as Record<string, unknown>).__BATTLE_READY = false
    }
  }, [gameType, net, selfId, role, hostId])

  return (
    <>
      <canvas
        ref={canvasRef}
        data-testid="battle-canvas"
        className="block size-full bg-slate-950 outline-none touch-none"
        tabIndex={0}
      />
      {isTouch && !portrait && <TouchControls actions={TOUCH_ACTIONS[gameType]} />}
      {isTouch && portrait && (
        <div
          className="absolute inset-0 z-30 flex flex-col items-center justify-center gap-4 bg-slate-950/95 p-6 text-center"
          data-testid="rotate-prompt"
        >
          <RotateCw className="size-14 animate-pulse text-indigo-400" aria-hidden="true" />
          <p className="text-lg font-bold text-slate-100">請將手機轉為橫向</p>
          <p className="text-sm text-slate-400">本遊戲需橫向遊玩</p>
        </div>
      )}
      {overlay && (
        <div
          className="absolute inset-0 z-20 flex items-center justify-center p-4 pointer-events-none"
          data-testid="battle-overlay"
        >
          <div className="pointer-events-auto w-full max-w-xs rounded-2xl border border-slate-700 bg-slate-900/95 p-5 text-center shadow-2xl backdrop-blur-sm space-y-3">
            <h3 className="whitespace-pre-line text-lg font-bold text-slate-100">{overlay.title}</h3>
            {overlay.subtitle && (
              <p className="whitespace-pre-line text-sm text-slate-300">{overlay.subtitle}</p>
            )}
            <div className="flex flex-col gap-2 pt-1">
              {overlay.actions.map((a) => (
                <Button
                  key={a.label}
                  onClick={a.onClick}
                  className={
                    a.variant === 'secondary'
                      ? 'h-11 rounded-xl border border-slate-700 bg-slate-800 text-slate-200 hover:bg-slate-700 cursor-pointer'
                      : 'h-11 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-bold hover:from-indigo-700 hover:to-purple-700 cursor-pointer'
                  }
                  data-testid="battle-overlay-action"
                >
                  {a.label}
                </Button>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  )
}

export default BabylonCanvas
