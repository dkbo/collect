import { useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Compass, Gamepad2, HelpCircle, Info, MessageSquare, X } from 'lucide-react'
import { useGodotStore } from '@/store/useGodotStore'
import { onGodotMessage, registerGodotWindow } from '@/lib/godotBridge'
import { renderMessage } from '@/pages/RpgRoom/lib/messageRenderer'

export function GodotGame() {
  const { isReady, mapName, isChat, npcName, npcText, setPaused, handleGodotMessage, resetGodot } =
    useGodotStore()
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const [showInstructions, setShowInstructions] = useState(false)
  const [isTouchDevice, setIsTouchDevice] = useState(false)

  // 訂閱 Godot iframe 事件並轉發進 Store
  useEffect(() => {
    const unsubscribe = onGodotMessage(handleGodotMessage)
    return () => {
      unsubscribe()
      registerGodotWindow(null)
      resetGodot()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // 偵測行動裝置（僅控制說明文案差異，操作本體在 Godot iframe 內）
  useEffect(() => {
    const mq = window.matchMedia('(pointer: coarse)')
    setIsTouchDevice(mq.matches)
    const onChange = (e: MediaQueryListEvent) => setIsTouchDevice(e.matches)
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])

  // iframe 載入完成：註冊通訊窗口並聚焦讓鍵盤輸入直達 Godot
  const handleFrameLoad = () => {
    const frame = iframeRef.current
    if (!frame) return
    registerGodotWindow(frame.contentWindow)
    frame.focus()
  }

  // 說明面板開關同步暫停 Godot；關閉後把鍵盤焦點還給 iframe
  const toggleInstructions = (open: boolean) => {
    setShowInstructions(open)
    setPaused(open)
    if (!open) iframeRef.current?.focus()
  }

  return (
    <div className="max-w-5xl mx-auto pb-12" data-testid="page-godot-game">
      {/* Title Header */}
      <header className="text-center mb-8">
        <h1 className="text-3xl md:text-5xl font-extrabold bg-gradient-to-r from-slate-900 via-slate-700 to-slate-500 dark:from-white dark:via-slate-200 dark:to-slate-400 bg-clip-text text-transparent leading-tight">
          Godot 遊戲
        </h1>
        <p className="mt-3 text-sm md:text-base text-slate-600 dark:text-slate-400 max-w-2xl mx-auto leading-relaxed">
          以 Godot 4 遊戲引擎重構的 RPG 遊戲室。引擎於 iframe 內運行，與 React 透過 postMessage 雙向通訊。
        </p>
      </header>

      {/* Game Menu Actions */}
      <div className="flex flex-wrap items-center gap-2 mb-4 justify-between select-none">
        <Button
          size="sm"
          variant="outline"
          onClick={() => toggleInstructions(true)}
          className="h-8 text-xs border-slate-700 text-slate-300 bg-slate-900/80 hover:bg-slate-800 hover:text-white cursor-pointer rounded-xl flex items-center gap-1"
        >
          <HelpCircle className="size-3.5" aria-hidden="true" />
          遊戲說明
        </Button>
      </div>

      {/* Arcade cabinet wrapper */}
      <div className="rpg-cabinet">
        {/* Game console screen: Godot Web Export iframe */}
        <div className="rpg-screen">
          <iframe
            ref={iframeRef}
            src={import.meta.env.BASE_URL + 'godot/index.html'}
            title="Godot RPG 遊戲"
            className="absolute inset-0 size-full border-0 bg-slate-950"
            tabIndex={0}
            onLoad={handleFrameLoad}
            allow="fullscreen"
            data-testid="godot-iframe"
          />

          {/* 載入中黑幕（Godot 引擎送出 READY 前顯示） */}
          {!isReady && (
            <div className="absolute inset-0 bg-black flex flex-col justify-center items-center z-50 animate-fade-in">
              <Compass className="size-12 text-purple-500 animate-spin mb-4" />
              <div className="text-white text-base tracking-widest animate-pulse font-mono font-bold select-none">
                Godot 引擎載入中...
              </div>
            </div>
          )}

          {/* Dialogue Box：Godot 送 NPC_CHAT 觸發，沿用 RpgRoom messageRenderer 與樣式 */}
          {isChat && (
            <div className="rpg-chat-box select-text cursor-default" data-testid="rpg-dialogue-box">
              <div className="font-extrabold text-amber-300 dark:text-amber-400 mb-1 flex items-center gap-1.5 border-b border-white/20 pb-1 text-base select-none">
                <MessageSquare className="size-4 shrink-0" />
                <span>{npcName}</span>
              </div>
              <div className="font-medium pr-6 min-h-[3.5em]">{renderMessage(npcText)}</div>
              <div className="absolute bottom-2.5 right-4 flex items-center text-[10px] text-white/50 tracking-wider font-semibold animate-pulse select-none">
                <span>{isTouchDevice ? '點 A 鈕繼續' : '按 SPACE 繼續'}</span>
                <span className="ml-1">▼</span>
              </div>
            </div>
          )}

          {/* Instruction Panel overlay（開啟時 Godot 暫停） */}
          {showInstructions && (
            <div className="absolute inset-0 bg-slate-950/90 z-40 flex flex-col justify-center items-center p-6 text-slate-100 animate-fade-in">
              <div className="max-w-md w-full bg-slate-900 border border-slate-800 p-6 rounded-2xl relative shadow-2xl">
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute top-3 right-3 text-slate-400 hover:text-white rounded-lg cursor-pointer"
                  onClick={() => toggleInstructions(false)}
                  aria-label="關閉說明"
                >
                  <X className="size-5" />
                </Button>

                <h3 className="text-xl font-bold text-center border-b border-slate-800 pb-3 mb-4 flex items-center justify-center gap-2">
                  <Gamepad2 className="size-6 text-purple-500" />
                  操作說明指南
                </h3>

                <div className="space-y-4 text-sm leading-relaxed">
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
                    <div
                      key={label}
                      className="flex justify-between items-center bg-slate-950/50 p-2.5 rounded-lg border border-slate-800/50"
                    >
                      <span className="font-semibold text-slate-300">{label}</span>
                      <span className="text-right text-xs bg-slate-800 px-2 py-1 rounded shadow-sm text-purple-400 font-mono">
                        {keys}
                      </span>
                    </div>
                  ))}
                  <div className="bg-purple-950/30 text-purple-200 p-3 rounded-lg border border-purple-900/30 text-xs mt-4 leading-normal">
                    <span className="font-bold block mb-1">💡 小訣竅</span>
                    走到特定的門口、樓梯或地圖邊界會自動切換地圖。面向告示牌、稻草人或NPC按對話鍵即可觸發交談。
                  </div>
                </div>

                <Button
                  className="w-full mt-6 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white font-bold rounded-xl cursor-pointer"
                  onClick={() => toggleInstructions(false)}
                >
                  開始遊戲
                </Button>
              </div>
            </div>
          )}

          {/* Floating Instructions HUD button on upper-right screen */}
          <Button
            variant="outline"
            size="icon"
            className="absolute top-4 right-4 z-30 size-9 rounded-xl border-slate-700 text-slate-400 bg-slate-900/80 hover:bg-slate-800 hover:text-white cursor-pointer backdrop-blur-sm"
            onClick={() => toggleInstructions(true)}
            aria-label="打開操作說明"
          >
            <HelpCircle className="size-4" />
          </Button>

          {/* Info HUD display on upper-left screen showing engine/map status */}
          <div className="absolute top-4 left-4 z-30 flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-700 bg-slate-900/80 text-slate-300 font-mono text-xs select-none backdrop-blur-sm pointer-events-none">
            <Info className="size-3.5 text-purple-400" />
            <span>{isReady ? `地圖: ${mapName || '加載中'}` : '引擎未連線'}</span>
          </div>
        </div>
      </div>
    </div>
  )
}

export default GodotGame
