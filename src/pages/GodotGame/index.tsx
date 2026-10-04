import { useEffect, useRef, useState } from 'react'
import { clsx } from 'clsx'
import { HelpCircle, Info, Lightbulb, Maximize2, Minimize2 } from 'lucide-react'
import { Button } from '@/components/toybox'
import { useGodotStore } from '@/store/useGodotStore'
import { onGodotMessage, registerGodotWindow } from '@/lib/godotBridge'
import { useFullscreen } from '@/lib/useFullscreen'
import { renderMessage } from '@/pages/RpgRoom/lib/messageRenderer'
import {
  ChatBox,
  GameDialog,
  GamePageHead,
  KeyRow,
  LoadingOverlay,
  PauseOverlay,
  ScreenIconButton,
  ScreenInfoTag,
  TipBar,
} from '@/pages/RpgRoom/lib/gameUi'
import '@/pages/GodotGame/GodotGame.css'

export function GodotGame() {
  const {
    isReady,
    mapName,
    playerX,
    playerY,
    isPaused,
    isChat,
    npcName,
    npcText,
    setPaused,
    handleGodotMessage,
    resetGodot,
  } = useGodotStore()
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const screenRef = useRef<HTMLDivElement>(null)
  const [showInstructions, setShowInstructions] = useState(false)
  const [isTouchDevice, setIsTouchDevice] = useState(
    () => window.matchMedia('(pointer: coarse)').matches
  )

  // 關閉面板/遮罩後把鍵盤焦點還給 Godot（同源 iframe，聚焦引擎綁定鍵盤的 canvas）
  const focusGame = () => {
    requestAnimationFrame(() => {
      const frame = iframeRef.current
      if (!frame) return
      frame.contentWindow?.focus()
      frame.contentDocument?.querySelector('canvas')?.focus()
    })
  }

  // 說明面板開關同步暫停 Godot（ref 鏡像供 UI_KEY 訂閱閉包讀取最新值）
  const showInstructionsRef = useRef(false)
  const toggleInstructions = (open: boolean) => {
    showInstructionsRef.current = open
    setShowInstructions(open)
    setPaused(open)
    if (!open) focusGame()
  }

  // P 鍵暫停切換（按鍵由 Godot 轉發 UI_KEY 而來）
  const togglePause = () => {
    const { isPaused: paused } = useGodotStore.getState()
    setPaused(!paused)
    if (paused) focusGame()
  }

  // 訂閱 Godot iframe 事件：UI_KEY 由外殼處理，其餘轉發進 Store
  useEffect(() => {
    const unsubscribe = onGodotMessage((msg) => {
      if (msg.type === 'UI_KEY') {
        if (msg.payload.key === 'pause') togglePause()
        else toggleInstructions(!showInstructionsRef.current)
        return
      }
      handleGodotMessage(msg)
    })
    return () => {
      unsubscribe()
      registerGodotWindow(null)
      resetGodot()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // 鍵盤後備：焦點在父頁面時 P/ESC 仍可操作（焦點在 iframe 時由 Godot 轉發 UI_KEY）
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

  // 偵測行動裝置變化（僅控制說明文案差異，操作本體在 Godot iframe 內）
  useEffect(() => {
    const mq = window.matchMedia('(pointer: coarse)')
    const onChange = (e: MediaQueryListEvent) => setIsTouchDevice(e.matches)
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])

  // 全螢幕（包畫面區容器，iframe 跟著撐滿）：
  // 原生 API 不可用（iPhone Safari）時自動 fallback 成 CSS 偽全螢幕
  const { isFullscreen, toggleFullscreen } = useFullscreen(screenRef, focusGame)

  // iframe 載入完成：註冊通訊窗口並聚焦讓鍵盤輸入直達 Godot
  const handleFrameLoad = () => {
    const frame = iframeRef.current
    if (!frame) return
    registerGodotWindow(frame.contentWindow)
    frame.focus()
  }

  return (
    <div className="tb-container godot-page" data-testid="page-godot-game">
      <div className="godot-col">
        <GamePageHead
          eyebrow="— GODOT 4 —"
          title="Godot 遊戲"
          intro="以 Godot 4 遊戲引擎重構的 RPG 遊戲室。引擎於 iframe 內運行，與 React 透過 postMessage 雙向通訊。"
        />

        {/* 工具列 */}
        <div className="flex flex-wrap items-center justify-between gap-3 select-none">
          <Button size="s" icon={<HelpCircle strokeWidth={2.5} aria-hidden="true" />} onClick={() => toggleInstructions(true)}>
            遊戲說明
          </Button>
        </div>

        {/* 遊戲畫面外框（ScreenFrame 結構；畫面區要掛 ref 給全螢幕，故直接寫 tb-screen） */}
        <div className="tb-screen">
          <div className="tb-screen__bar">
            <span className="tb-screen__title">GODOT GAME</span>
            <span className="tb-screen__meta">GODOT 4</span>
          </div>
          <div
            ref={screenRef}
            className={clsx('tb-screen__view', isFullscreen ? 'godot-screen__view--full' : 'godot-screen__view')}
          >
            <iframe
              ref={iframeRef}
              src={import.meta.env.BASE_URL + 'godot/index.html'}
              title="Godot RPG 遊戲"
              className="absolute inset-0 size-full border-0 bg-inverse"
              tabIndex={0}
              onLoad={handleFrameLoad}
              allow="fullscreen"
              data-testid="godot-iframe"
            />

            {/* 載入中（Godot 引擎送出 READY 前顯示） */}
            {!isReady && <LoadingOverlay text="Godot 引擎載入中..." />}

            {/* Dialogue Box：Godot 送 NPC_CHAT 觸發，沿用 RpgRoom messageRenderer */}
            {isChat && (
              <ChatBox name={npcName} hint={isTouchDevice ? '點 A 鈕繼續' : '按 SPACE 繼續'}>
                {renderMessage(npcText)}
              </ChatBox>
            )}

            {/* 暫停遮罩（P 鍵切換，點擊恢復） */}
            {isPaused && !showInstructions && (
              <PauseOverlay hint="點擊畫面或按 P 鍵恢復" onResume={togglePause} testId="godot-pause-overlay" />
            )}

            {/* 說明對話框（開啟時 Godot 暫停） */}
            {showInstructions && (
              <GameDialog title="操作說明指南" primaryLabel="開始遊戲" onClose={() => toggleInstructions(false)}>
                <div className="flex flex-col">
                  {(isTouchDevice
                    ? [
                        ['移動角色', '按住畫面拖曳（虛擬搖桿）'],
                        ['對話/互動', '畫面右下 A 按鈕'],
                        ['開啟本選單', '畫面右上 ? 按鈕'],
                      ]
                    : [
                        ['移動角色', 'W A S D / 方向鍵'],
                        ['對話/互動', 'SPACE / ENTER'],
                        ['暫停遊戲', 'P 鍵'],
                        ['開啟本選單', 'ESC 鍵'],
                      ]
                  ).map(([label, keys]) => (
                    <KeyRow key={label} label={label} keys={keys} />
                  ))}
                </div>
                <TipBar icon={<Lightbulb strokeWidth={2.5} aria-hidden="true" />}>
                  <span className="block font-bold">小訣竅</span>
                  走到特定的門口、樓梯或地圖邊界會自動切換地圖。面向告示牌、稻草人或NPC按對話鍵即可觸發交談。
                </TipBar>
              </GameDialog>
            )}

            {/* 浮動按鈕列（safe-area 感知，避開瀏海/圓角） */}
            <div className="absolute top-[max(1rem,env(safe-area-inset-top))] right-[max(1rem,env(safe-area-inset-right))] z-30 flex gap-2">
              <ScreenIconButton
                icon={isFullscreen ? <Minimize2 strokeWidth={2.5} /> : <Maximize2 strokeWidth={2.5} />}
                label="切換全螢幕"
                onClick={toggleFullscreen}
                data-testid="godot-fullscreen-btn"
              />
              {!isFullscreen && (
                <ScreenIconButton
                  icon={<HelpCircle strokeWidth={2.5} />}
                  label="打開操作說明"
                  onClick={() => toggleInstructions(true)}
                />
              )}
            </div>

            {/* 左上資訊籤：地圖與座標 */}
            <ScreenInfoTag>
              <div className="flex items-center gap-2 font-body text-caption">
                <Info className="size-4 shrink-0 text-pop" strokeWidth={2.5} />
                <span>{isReady ? `地圖: ${mapName || '加載中'}` : '引擎未連線'}</span>
              </div>
              {isReady && (
                <div className="text-on-inverse-muted">
                  <span className="font-body text-caption">座標</span> X:{playerX} Y:{playerY}
                </div>
              )}
            </ScreenInfoTag>
          </div>
        </div>
      </div>
    </div>
  )
}

export default GodotGame
