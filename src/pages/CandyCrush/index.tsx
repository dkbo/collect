import { useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Candy, Footprints, HelpCircle, Maximize2, Minimize2, Pause, Play, RotateCcw, Star, Trophy, Volume2, VolumeX, X } from 'lucide-react'
import { useCandyStore } from '@/store/useCandyStore'
import { onCandyMessage, registerCandyWindow } from '@/lib/candyBridge'
import { useFullscreen } from '@/lib/useFullscreen'

/** 關卡總數（與 godot-candy-src/data/candy_levels.json 同步） */
const MAX_LEVEL = 5

/** 星級刻度：達標 1★（50%）、1.5 倍 2★（75%）、2 倍 3★（100%），進度條滿格 = 2 倍目標 */
const STAR_TICKS = [
  { star: 1, percent: 50 },
  { star: 2, percent: 75 },
  { star: 3, percent: 100 },
]

export function CandyCrush() {
  const {
    isReady, isPaused, setPaused, isMuted, setMuted, handleCandyMessage, resetCandy,
    level, score, moves, target, stars,
    isLevelEnd, won, endLevel, endScore, endStars, startLevel,
  } = useCandyStore()
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const screenRef = useRef<HTMLDivElement>(null)
  const [showInstructions, setShowInstructions] = useState(false)
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
        <h1 className="text-3xl md:text-5xl font-extrabold bg-gradient-to-r from-pink-500 via-rose-400 to-orange-400 bg-clip-text text-transparent leading-tight">
          糖果消消樂
        </h1>
        <p className="mt-3 text-sm md:text-base text-slate-600 dark:text-slate-400 max-w-2xl mx-auto leading-relaxed">
          以 Godot 4 打造的 match-3 三消遊戲。引擎於 iframe 內運行，與 React 透過 postMessage 雙向通訊。
        </p>
      </header>

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

      {/* HUD：關卡 / 分數進度（星級刻度）/ 剩餘步數 */}
      <div
        className="mb-4 bg-slate-900/90 border border-slate-800 rounded-2xl px-4 py-3 flex items-center gap-4 select-none shadow-lg"
        data-testid="candy-hud"
      >
        <div className="flex flex-col items-center min-w-14">
          <span className="text-[10px] text-slate-400 font-semibold tracking-widest">關卡</span>
          <span className="text-2xl font-extrabold text-pink-400 leading-none" data-testid="hud-level">
            {level}
          </span>
        </div>

        <div className="flex-1 pt-2">
          <div className="flex justify-between items-baseline text-[11px] text-slate-400 mb-1.5">
            <span className="font-mono font-bold text-base text-slate-100" data-testid="hud-score">
              {score.toLocaleString()}
            </span>
            <span>
              目標 <span className="font-mono text-slate-200">{target.toLocaleString()}</span>
            </span>
          </div>
          <div className="relative h-3 bg-slate-800 rounded-full">
            <div
              className="h-full bg-gradient-to-r from-pink-500 to-rose-400 rounded-full transition-[width] duration-500"
              style={{ width: `${target > 0 ? Math.min((score / (2 * target)) * 100, 100) : 0}%` }}
              data-testid="hud-progress"
            />
            {STAR_TICKS.map(({ star, percent }) => (
              <Star
                key={star}
                className={`absolute -top-2 size-4 -translate-x-1/2 transition-colors ${
                  stars >= star ? 'text-amber-400 fill-amber-400' : 'text-slate-600 fill-slate-800'
                }`}
                style={{ left: `${percent}%` }}
                aria-label={`${star} 星刻度`}
              />
            ))}
          </div>
        </div>

        <div className="flex flex-col items-center min-w-14">
          <span className="text-[10px] text-slate-400 font-semibold tracking-widest flex items-center gap-0.5">
            <Footprints className="size-3" aria-hidden="true" />
            步數
          </span>
          <span
            className={`text-2xl font-extrabold leading-none ${moves <= 5 ? 'text-rose-400' : 'text-slate-100'}`}
            data-testid="hud-moves"
          >
            {moves}
          </span>
        </div>
      </div>

      <div className="rpg-cabinet">
        <div
          ref={screenRef}
          className={
            isFullscreen
              ? 'fixed inset-0 w-screen h-dvh bg-black z-50 border-0 rounded-none select-none'
              : 'rpg-screen'
          }
        >
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

          {!isReady && (
            <div className="absolute inset-0 bg-black flex flex-col justify-center items-center z-50 animate-fade-in">
              <Candy className="size-12 text-pink-500 animate-bounce mb-4" />
              <div className="text-white text-base tracking-widest animate-pulse font-mono font-bold select-none">
                糖果消消樂載入中...
              </div>
            </div>
          )}

          {isPaused && !showInstructions && (
            <div
              className="absolute inset-0 bg-slate-950/60 z-30 flex flex-col justify-center items-center gap-3 cursor-pointer animate-fade-in"
              onClick={togglePause}
              data-testid="candy-pause-overlay"
            >
              <span className="text-2xl font-extrabold text-pink-400 select-none">遊戲暫停中</span>
              <span className="text-sm text-slate-300 select-none">點擊畫面或按 P 鍵恢復</span>
            </div>
          )}

          {isLevelEnd && !showInstructions && (
            <div
              className="absolute inset-0 bg-slate-950/85 z-30 flex flex-col justify-center items-center gap-4 animate-fade-in p-6"
              data-testid="candy-result"
            >
              <h2 className="text-3xl font-extrabold flex items-center gap-2">
                {won ? (
                  <>
                    <Trophy className="size-8 text-amber-400" aria-hidden="true" />
                    <span className="text-pink-400">第 {endLevel} 關通關！</span>
                  </>
                ) : (
                  <span className="text-slate-300">步數用完，挑戰失敗</span>
                )}
              </h2>

              <div className="flex gap-2" data-testid="result-stars">
                {[1, 2, 3].map((s) => (
                  <Star
                    key={s}
                    className={`size-10 ${
                      endStars >= s ? 'text-amber-400 fill-amber-400' : 'text-slate-700 fill-slate-800'
                    }`}
                  />
                ))}
              </div>

              <div className="text-slate-200 text-lg">
                得分 <span className="font-mono font-bold text-2xl text-white">{endScore.toLocaleString()}</span>
              </div>

              {won && endLevel >= MAX_LEVEL && (
                <div className="text-amber-300 font-bold">恭喜全部通關！</div>
              )}

              <div className="flex gap-3 mt-2">
                <Button
                  variant="outline"
                  className="border-slate-600 text-slate-200 bg-slate-900/80 hover:bg-slate-800 hover:text-white font-bold rounded-xl cursor-pointer"
                  onClick={() => { startLevel(endLevel); focusGame() }}
                  data-testid="result-replay"
                >
                  <RotateCcw className="size-4" aria-hidden="true" />
                  重玩本關
                </Button>
                {won && endLevel < MAX_LEVEL && (
                  <Button
                    className="bg-gradient-to-r from-pink-600 to-rose-600 hover:from-pink-700 hover:to-rose-700 text-white font-bold rounded-xl cursor-pointer"
                    onClick={() => { startLevel(endLevel + 1); focusGame() }}
                    data-testid="result-next"
                  >
                    下一關 →
                  </Button>
                )}
                {won && endLevel >= MAX_LEVEL && (
                  <Button
                    className="bg-gradient-to-r from-pink-600 to-rose-600 hover:from-pink-700 hover:to-rose-700 text-white font-bold rounded-xl cursor-pointer"
                    onClick={() => { startLevel(1); focusGame() }}
                    data-testid="result-restart"
                  >
                    從第 1 關再玩
                  </Button>
                )}
              </div>
            </div>
          )}

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
                  <Candy className="size-6 text-pink-500" />
                  操作說明
                </h3>

                <div className="space-y-4 text-sm leading-relaxed">
                  {(isTouchDevice
                    ? [
                        ['交換糖果', '點選兩顆相鄰糖果，或滑動拖曳'],
                        ['暫停遊戲', '畫面右上 ⏸ 按鈕'],
                        ['開啟本選單', '畫面右上 ? 按鈕'],
                      ]
                    : [
                        ['交換糖果', '點選兩顆相鄰糖果，或拖曳'],
                        ['暫停遊戲', 'P 鍵或右上 ⏸ 按鈕'],
                        ['開啟本選單', 'ESC 鍵'],
                      ]
                  ).map(([label, keys]) => (
                    <div
                      key={label}
                      className="flex justify-between items-center bg-slate-950/50 p-2.5 rounded-lg border border-slate-800/50"
                    >
                      <span className="font-semibold text-slate-300">{label}</span>
                      <span className="text-right text-xs bg-slate-800 px-2 py-1 rounded shadow-sm text-pink-400 font-mono">
                        {keys}
                      </span>
                    </div>
                  ))}
                  <div className="bg-pink-950/30 text-pink-200 p-3 rounded-lg border border-pink-900/30 text-xs mt-4 leading-normal">
                    <span className="font-bold block mb-1">目標</span>
                    在步數限制內達到目標分數，消除 3 顆以上相同顏色的糖果得分。特殊糖果可觸發更強力的消除！
                  </div>
                </div>

                <Button
                  className="w-full mt-6 bg-gradient-to-r from-pink-600 to-rose-600 hover:from-pink-700 hover:to-rose-700 text-white font-bold rounded-xl cursor-pointer"
                  onClick={() => toggleInstructions(false)}
                >
                  開始遊戲
                </Button>
              </div>
            </div>
          )}

          {/* 浮動按鈕列（safe-area 感知，避開瀏海/圓角） */}
          <div className="absolute z-30 flex gap-2 top-[max(1rem,env(safe-area-inset-top))] right-[max(1rem,env(safe-area-inset-right))]">
            <Button
              variant="outline"
              size="icon"
              className="size-9 rounded-xl border-slate-700 text-slate-400 bg-slate-900/80 hover:bg-slate-800 hover:text-white cursor-pointer backdrop-blur-sm shadow-md"
              onClick={() => { setMuted(!isMuted); focusGame() }}
              aria-label={isMuted ? '開啟音效' : '靜音'}
              data-testid="candy-mute-btn"
            >
              {isMuted ? <VolumeX className="size-4" /> : <Volume2 className="size-4" />}
            </Button>

            <Button
              variant="outline"
              size="icon"
              className="size-9 rounded-xl border-slate-700 text-slate-400 bg-slate-900/80 hover:bg-slate-800 hover:text-white cursor-pointer backdrop-blur-sm shadow-md"
              onClick={togglePause}
              aria-label={isPaused ? '恢復遊戲' : '暫停遊戲'}
              data-testid="candy-pause-btn"
            >
              {isPaused ? <Play className="size-4" /> : <Pause className="size-4" />}
            </Button>

            <Button
              variant="outline"
              size="icon"
              className="size-9 rounded-xl border-slate-700 text-slate-400 bg-slate-900/80 hover:bg-slate-800 hover:text-white cursor-pointer backdrop-blur-sm shadow-md"
              onClick={toggleFullscreen}
              aria-label="切換全螢幕"
              data-testid="candy-fullscreen-btn"
            >
              {isFullscreen ? <Minimize2 className="size-4" /> : <Maximize2 className="size-4" />}
            </Button>

            {!isFullscreen && (
              <Button
                variant="outline"
                size="icon"
                className="size-9 rounded-xl border-slate-700 text-slate-400 bg-slate-900/80 hover:bg-slate-800 hover:text-white cursor-pointer backdrop-blur-sm"
                onClick={() => toggleInstructions(true)}
                aria-label="打開操作說明"
              >
                <HelpCircle className="size-4" />
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default CandyCrush
