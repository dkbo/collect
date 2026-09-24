import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { Candy, HelpCircle } from 'lucide-react'
import { useCandyStore } from '@/store/useCandyStore'
import { onCandyMessage, registerCandyWindow } from '@/lib/candyBridge'
import { useFullscreen } from '@/lib/useFullscreen'
import { HudButtons, SideHud, TopBar } from '@/pages/CandyCrush/CandyHud'
import { InstructionsDialog, PauseOverlay, ResultDialog } from '@/pages/CandyCrush/CandyOverlays'
import { hudLayout, isCompactTopBar, type HudLayout } from '@/pages/CandyCrush/candyHud'

/** 關卡總數（與 godot-candy-src/data/candy_levels.json 同步） */
const MAX_LEVEL = 5

export function CandyCrush() {
  const {
    isReady, isPaused, setPaused, isMuted, setMuted, handleCandyMessage, resetCandy,
    isLevelEnd, startLevel,
  } = useCandyStore()
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const screenRef = useRef<HTMLDivElement>(null)
  const [showInstructions, setShowInstructions] = useState(false)
  const [layout, setLayout] = useState<HudLayout>({ mode: 'side', scale: 1 })
  const [compactBar, setCompactBar] = useState(false)
  const [isTouchDevice, setIsTouchDevice] = useState(
    () => window.matchMedia('(pointer: coarse)').matches
  )

  const focusGame = () => {
    requestAnimationFrame(() => {
      const frame = iframeRef.current
      if (!frame) return
      frame.contentWindow?.focus()
      frame.contentDocument?.querySelector('canvas')?.focus()
    })
  }

  const showInstructionsRef = useRef(false)
  const toggleInstructions = (open: boolean) => {
    showInstructionsRef.current = open
    setShowInstructions(open)
    setPaused(open)
    if (!open) focusGame()
  }

  const togglePause = () => {
    const { isPaused: paused } = useCandyStore.getState()
    setPaused(!paused)
    if (paused) focusGame()
  }

  useEffect(() => {
    const unsubscribe = onCandyMessage((msg) => {
      handleCandyMessage(msg)
    })
    return () => {
      unsubscribe()
      registerCandyWindow(null)
      resetCandy()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'p' || e.key === 'P') {
        e.preventDefault()
        togglePause()
      } else if (e.key === 'Escape') {
        e.preventDefault()
        toggleInstructions(!showInstructionsRef.current)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    const mq = window.matchMedia('(pointer: coarse)')
    const onChange = (e: MediaQueryListEvent) => setIsTouchDevice(e.matches)
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])

  // HUD 版面以 .rpg-screen 容器寬高比為準（含全螢幕），尺寸變化即重算；
  // 用 layout effect 在首次繪製前量好，避免手機首幀閃一次兩側 HUD
  useLayoutEffect(() => {
    const el = screenRef.current
    if (!el) return
    const update = () => {
      const next = hudLayout(el.clientWidth, el.clientHeight)
      setLayout((prev) => (prev.mode === next.mode && prev.scale === next.scale ? prev : next))
      setCompactBar(isCompactTopBar(el.clientWidth))
    }
    update()
    const observer = new ResizeObserver(update)
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  // 全螢幕：原生 API 不可用（iPhone Safari）時自動 fallback 成 CSS 偽全螢幕
  const { isFullscreen, toggleFullscreen } = useFullscreen(screenRef, focusGame)

  const handleFrameLoad = () => {
    const frame = iframeRef.current
    if (!frame) return
    registerCandyWindow(frame.contentWindow)
    frame.focus()
  }

  return (
    <div className="max-w-5xl mx-auto pb-12" data-testid="page-candy-crush">
      <header className="text-center mb-8">
        <h1 className="candy-title">糖果消消樂</h1>
        <p className="candy-subtitle">
          以 <span className="candy-num">Godot 4</span> 打造的 <span className="candy-num">match-3</span> 三消遊戲。引擎於 <span className="candy-num">iframe</span> 內運行，與 <span className="candy-num">React</span> 透過 <span className="candy-num">postMessage</span> 雙向通訊。
        </p>
      </header>

      <div className="flex flex-wrap items-center gap-2 mb-4 justify-between select-none">
        <button type="button" onClick={() => toggleInstructions(true)} className="candy-tool-btn">
          <HelpCircle className="size-3.5" aria-hidden="true" />
          遊戲說明
        </button>
      </div>

      <div className="rpg-cabinet">
        <div
          ref={screenRef}
          data-hud={layout.mode}
          className={
            isFullscreen
              ? 'fixed inset-0 w-screen h-dvh bg-black z-50 border-0 rounded-none select-none'
              : 'rpg-screen'
          }
        >
          <div className="absolute inset-0 flex flex-col">
            {layout.mode === 'top' && <TopBar compact={compactBar} />}
            {/* iframe 的 DOM 位置固定，切換版面不會重載遊戲 */}
            <div className="relative min-h-0 flex-1">
              <iframe
                ref={iframeRef}
                src={import.meta.env.BASE_URL + 'candy/index.html'}
                title="糖果消消樂遊戲"
                className="absolute inset-0 size-full border-0 bg-slate-950"
                tabIndex={0}
                onLoad={handleFrameLoad}
                allow="fullscreen"
                style={{ touchAction: 'none' }}
                data-testid="candy-iframe"
              />
            </div>
          </div>

          {layout.mode === 'side' && <SideHud scale={layout.scale} />}

          {!isReady && (
            <div className="candy-loading" data-testid="candy-loading">
              <div className="candy-loading-icon">
                <Candy className="size-10" aria-hidden="true" />
              </div>
              <div className="candy-loading-text">糖果消消樂載入中...</div>
            </div>
          )}

          {isPaused && !showInstructions && <PauseOverlay onResume={togglePause} />}

          {isLevelEnd && !showInstructions && (
            <ResultDialog maxLevel={MAX_LEVEL} onStart={(lv) => { startLevel(lv); focusGame() }} />
          )}

          {showInstructions && (
            <InstructionsDialog isTouchDevice={isTouchDevice} onClose={() => toggleInstructions(false)} />
          )}

          {/* 圓鈕疊在暫停／結算遮罩之上（safe-area 感知，避開瀏海/圓角） */}
          <HudButtons
            mode={layout.mode}
            scale={layout.scale}
            compact={compactBar}
            isFullscreen={isFullscreen}
            onMute={() => { setMuted(!isMuted); focusGame() }}
            onPause={togglePause}
            onFullscreen={toggleFullscreen}
            onHelp={() => toggleInstructions(true)}
          />
        </div>
      </div>
    </div>
  )
}

export default CandyCrush
