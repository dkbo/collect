import { useEffect, useRef } from 'react'
import { Engine, Scene } from '@babylonjs/core'
import type { NetTransport } from '@/core/webrtc'
import type { GamePlayer } from '@/babylon/types'
import { getGameFactory } from '@/babylon/games'
import type { GameType } from '@/core/room'

interface BabylonCanvasProps {
  gameType: GameType
  net: NetTransport
  selfId: string
  role: 'host' | 'guest'
  players: GamePlayer[]
}

/**
 * Babylon 引擎掛載點（計畫 §2）。負責 Engine/Scene 生命週期、
 * 依 gameType 實例化 GameModule、把 NetTransport 訊息轉進場景、跑 render loop，
 * 卸載時依序釋放所有資源。遊戲本身與網路同處 JS context，無 iframe/postMessage。
 */
export function BabylonCanvas({ gameType, net, selfId, role, players }: BabylonCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  // players 走 ref，避免列表變動觸發引擎重建（init 只在掛載時讀一次初始值）
  const playersRef = useRef(players)
  useEffect(() => {
    playersRef.current = players
  }, [players])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const engine = new Engine(canvas, true, { preserveDrawingBuffer: true, stencil: true })
    const scene = new Scene(engine)
    const game = getGameFactory(gameType)()
    game.init({ scene, net, selfId, role, players: playersRef.current })

    const offMessage = net.on('message', (from, msg) => game.onNetworkMessage(from, msg))

    engine.runRenderLoop(() => {
      game.update(engine.getDeltaTime())
      scene.render()
      // 驗證用：曝露就緒旗標與場景物件數
      ;(window as unknown as Record<string, unknown>).__BATTLE_READY = true
      ;(window as unknown as Record<string, unknown>).__BATTLE_MESHES = scene.meshes.length
    })

    const resize = () => engine.resize()
    window.addEventListener('resize', resize)
    const ro = new ResizeObserver(resize)
    ro.observe(canvas)

    return () => {
      ro.disconnect()
      window.removeEventListener('resize', resize)
      offMessage()
      engine.stopRenderLoop()
      game.dispose()
      scene.dispose()
      engine.dispose()
      ;(window as unknown as Record<string, unknown>).__BATTLE_READY = false
    }
  }, [gameType, net, selfId, role])

  return (
    <canvas
      ref={canvasRef}
      data-testid="battle-canvas"
      className="w-full aspect-video rounded-xl bg-slate-950 outline-none touch-none"
      tabIndex={0}
    />
  )
}

export default BabylonCanvas
