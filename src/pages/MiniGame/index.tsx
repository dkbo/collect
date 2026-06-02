import { useEffect, useState, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Gamepad2, RotateCcw, Shield, Coins, Sparkles, ArrowUp, ArrowDown, ArrowLeft, ArrowRight, Maximize2, Minimize2, HelpCircle } from 'lucide-react'
import { useThemeStore } from '@/store/useThemeStore'

const GAME_WIDTH = 800
const GAME_HEIGHT = 450

interface GameState {
  x: number
  y: number
  w: number
  h: number
  sp: number
  key: {
    up: boolean
    right: boolean
    down: boolean
    left: boolean
  }
  bow: Array<{ x: number; y: number }>
  wall: Array<{ x: number; y: number; h: number; w: number }>
  hp: number
  score: number
  isActive: boolean
  isPaused?: boolean
}

export function MiniGame() {
  const { theme } = useThemeStore()
  const canvasEl = useRef<HTMLCanvasElement>(null)
  const requestRef = useRef<number | null>(null)
  
  const [score, setScore] = useState(0)
  const [hp, setHp] = useState(10)
  const [highScore, setHighScore] = useState(() => {
    const saved = localStorage.getItem('game_highscore')
    return saved ? parseInt(saved, 10) : 0
  })

  const canvasContainerRef = useRef<HTMLDivElement>(null)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [isPaused, setIsPaused] = useState(false)
  const [showInstructions, setShowInstructions] = useState(false)

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(document.fullscreenElement === canvasContainerRef.current)
    }
    document.addEventListener('fullscreenchange', handleFullscreenChange)
    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange)
    }
  }, [])

  const toggleFullscreen = () => {
    const container = canvasContainerRef.current
    if (!container) return
    if (!document.fullscreenElement) {
      container.requestFullscreen().catch((err) => {
        console.error('Error enabling fullscreen:', err)
      })
    } else {
      document.exitFullscreen()
    }
  }

  // Encapsulate mutable state in a single Ref to avoid closures and multi-mount leaks
  const stateRef = useRef<GameState>({
    x: 50,
    y: 200,
    w: 15,
    h: 20,
    sp: 4,
    key: { up: false, right: false, down: false, left: false },
    bow: [],
    wall: [],
    hp: 10,
    score: 0,
    isActive: true,
    isPaused: false
  })

  const keydown = (e: KeyboardEvent) => {
    // Prevent default scroll behavior for game control keys
    if ([32, 37, 38, 39, 40, 27, 80].includes(e.keyCode)) {
      e.preventDefault()
    }
    const s = stateRef.current

    if (e.keyCode === 27 || e.keyCode === 80) { // Esc or P
      if (s.hp > 0) {
        setIsPaused((prev) => {
          const val = !prev
          s.isPaused = val
          return val
        })
      }
      return
    }

    if (s.isPaused) return

    switch (e.keyCode) {
      case 32: // Space
        s.bow.push({ x: 15 + s.x, y: s.y + s.w / 2 })
        break
      case 37: // Left
        s.key.left = true
        break
      case 38: // Up
        s.key.up = true
        break
      case 39: // Right
        s.key.right = true
        break
      case 40: // Down
        s.key.down = true
        break
    }
  }

  const keyup = (e: KeyboardEvent) => {
    if ([37, 38, 39, 40].includes(e.keyCode)) {
      e.preventDefault()
    }
    const s = stateRef.current
    switch (e.keyCode) {
      case 37:
        s.key.left = false
        break
      case 38:
        s.key.up = false
        break
      case 39:
        s.key.right = false
        break
      case 40:
        s.key.down = false
        break
    }
  }

  const random = (min: number, max: number) => 
    Math.floor(Math.random() * (max - min + 1)) + min

  const animation = () => {
    const canvas = canvasEl.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const s = stateRef.current
    // Stop the loop instantly if component is unmounted / page switched
    if (!s.isActive) return

    if (s.isPaused) {
      ctx.fillStyle = 'rgba(15, 23, 42, 0.7)'
      ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT)
      
      ctx.fillStyle = '#a855f7'
      ctx.shadowColor = '#a855f7'
      ctx.shadowBlur = 15
      ctx.font = 'bold 36px sans-serif'
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText('遊戲暫停中', GAME_WIDTH / 2, GAME_HEIGHT / 2)
      
      ctx.font = '16px sans-serif'
      ctx.fillStyle = '#94a3b8'
      ctx.shadowBlur = 0
      ctx.fillText('按 P 鍵或 ESC 繼續遊戲', GAME_WIDTH / 2, GAME_HEIGHT / 2 + 50)
      
      requestRef.current = requestAnimationFrame(animation)
      return
    }

    // Clear Canvas
    ctx.clearRect(0, 0, GAME_WIDTH, GAME_HEIGHT)

    // Draw grid background for space retro aesthetic
    ctx.strokeStyle = theme === 'dark' ? 'rgba(168, 85, 247, 0.05)' : 'rgba(168, 85, 247, 0.08)'
    ctx.lineWidth = 1
    const gridSize = 45
    for (let i = 0; i < GAME_WIDTH; i += gridSize) {
      ctx.beginPath()
      ctx.moveTo(i, 0)
      ctx.lineTo(i, GAME_HEIGHT)
      ctx.stroke()
    }
    for (let j = 0; j < GAME_HEIGHT; j += gridSize) {
      ctx.beginPath()
      ctx.moveTo(0, j)
      ctx.lineTo(GAME_WIDTH, j)
      ctx.stroke()
    }

    // Move player based on inputs
    if (s.key.up && s.y > 0) s.y = Math.max(0, s.y - s.sp)
    if (s.key.down && s.y + s.h < GAME_HEIGHT) s.y = Math.min(GAME_HEIGHT - s.h, s.y + s.sp)
    if (s.key.left && s.x > 0) s.x = Math.max(0, s.x - s.sp)
    if (s.key.right && s.x + s.w < GAME_WIDTH) s.x = Math.min(GAME_WIDTH - s.w, s.x + s.sp)

    // Draw glowing player spaceship (triangle pointing right)
    ctx.fillStyle = '#a855f7' // purple neon
    ctx.shadowColor = '#a855f7'
    ctx.shadowBlur = 10
    ctx.beginPath()
    ctx.moveTo(s.x, s.y)
    ctx.lineTo(s.x + s.h, s.y + s.w / 2)
    ctx.lineTo(s.x, s.y + s.w)
    ctx.closePath()
    ctx.fill()
    ctx.shadowBlur = 0 // reset shadow blur

    // Draw Lasers (Bows)
    if (s.bow.length > 0) {
      ctx.strokeStyle = '#38bdf8' // neon sky blue
      ctx.lineWidth = 3
      ctx.shadowColor = '#38bdf8'
      ctx.shadowBlur = 8

      for (let i = 0; i < s.bow.length; i++) {
        const b = s.bow[i]
        b.x += 6 // Laser horizontal speed

        // Offscreen boundary check
        if (b.x >= GAME_WIDTH) {
          s.bow.splice(i, 1)
          i--
          continue
        }

        // Collision check with enemy walls
        if (s.wall.length > 0) {
          let hit = false
          for (let j = 0; j < s.wall.length; j++) {
            const w = s.wall[j]
            const checkX = b.x + 12 > w.x
            const checkY = b.y >= w.y && b.y <= w.y + w.h

            if (checkX && checkY) {
              s.wall.splice(j, 1)
              hit = true
              break
            }
          }

          if (hit) {
            s.score += 100
            setScore(s.score)
            if (s.score > highScore) {
              setHighScore(s.score)
              localStorage.setItem('game_highscore', s.score.toString())
            }
            s.bow.splice(i, 1)
            i--
            continue
          }
        }

        // Render laser
        ctx.beginPath()
        ctx.moveTo(b.x, b.y)
        ctx.lineTo(b.x + 12, b.y)
        ctx.stroke()
      }
      ctx.shadowBlur = 0
    }

    // Move & Draw Enemy Obstacles (Walls)
    if (s.wall.length > 0) {
      ctx.shadowColor = '#f43f5e'
      ctx.shadowBlur = 6

      for (let i = 0; i < s.wall.length; i++) {
        const w = s.wall[i]
        w.x -= 2 // Obstacle movement speed

        // Damage trigger on reaching left boundary
        if (w.x < 0) {
          s.wall.splice(i, 1)
          s.hp -= 1
          setHp(s.hp)
          if (s.hp <= 0) {
            // Exit immediately, do not schedule next animation frame
            return
          }
          i--
          continue
        }

        // Render obstacle
        ctx.strokeStyle = '#f43f5e' // neon rose
        ctx.lineWidth = w.w
        ctx.beginPath()
        ctx.moveTo(w.x, w.y)
        ctx.lineTo(w.x, w.y + w.h)
        ctx.stroke()
      }
      ctx.shadowBlur = 0
    }

    // Spawn new obstacles randomly
    if (random(0, 30) === 0) {
      s.wall.push({
        x: GAME_WIDTH,
        y: random(0, GAME_HEIGHT - 35),
        h: random(15, 35),
        w: random(4, 8)
      })
    }

    requestRef.current = requestAnimationFrame(animation)
  }

  const startGame = () => {
    setIsPaused(false)
    stateRef.current = {
      x: 50,
      y: 200,
      w: 15,
      h: 20,
      sp: 4,
      key: { up: false, right: false, down: false, left: false },
      bow: [],
      wall: [],
      hp: 10,
      score: 0,
      isActive: true,
      isPaused: false
    }
    setScore(0)
    setHp(10)
    if (requestRef.current) cancelAnimationFrame(requestRef.current)
    requestRef.current = requestAnimationFrame(animation)
  }

  useEffect(() => {
    window.addEventListener('keydown', keydown)
    window.addEventListener('keyup', keyup)
    
    // Start game loop on mount
    stateRef.current.isActive = true
    requestRef.current = requestAnimationFrame(animation)
    
    return () => {
      window.removeEventListener('keydown', keydown)
      window.removeEventListener('keyup', keyup)
      // Stop the loop completely on unmount
      stateRef.current.isActive = false
      if (requestRef.current) {
        cancelAnimationFrame(requestRef.current)
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div className="max-w-4xl mx-auto pb-12" data-testid="page-minigame">
      {/* Title Header */}
      <header className="text-center mb-8">
        <h1 className="text-3xl md:text-5xl font-extrabold bg-gradient-to-r from-slate-900 via-slate-700 to-slate-500 dark:from-white dark:via-slate-200 dark:to-slate-400 bg-clip-text text-transparent leading-tight">
          復古射擊小遊戲
        </h1>
        <p className="mt-3 text-sm md:text-base text-slate-600 dark:text-slate-400 max-w-2xl mx-auto leading-relaxed">
          使用方向鍵控制戰機，空白鍵發射光子束消滅紅色障礙。躲避或擊毀它們，別讓障礙突破防線！
        </p>
      </header>

      {/* Arcade cabinet wrapper */}
      <div 
        className="relative border-4 border-slate-800 dark:border-slate-700 rounded-3xl bg-slate-900 shadow-2xl p-4 md:p-6 overflow-hidden max-w-3xl mx-auto transition-all duration-300"
      >
        
        {/* Game Menu Actions */}
        <div className="flex flex-wrap items-center gap-2 mb-4 justify-between border-b border-slate-800/60 pb-3 select-none">
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => setShowInstructions(true)}
              className="h-8 text-xs border-slate-700 text-slate-300 bg-slate-950/80 hover:bg-slate-800 hover:text-white cursor-pointer rounded-xl flex items-center gap-1"
            >
              <HelpCircle className="size-3.5" aria-hidden="true" />
              遊戲說明
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                const s = stateRef.current
                if (hp > 0) {
                  setIsPaused((prev) => {
                    const val = !prev
                    s.isPaused = val
                    return val
                  })
                }
              }}
              className="h-8 text-xs border-slate-700 text-slate-300 bg-slate-950/80 hover:bg-slate-800 hover:text-white cursor-pointer rounded-xl"
            >
              {isPaused ? "繼續遊戲" : "暫停遊戲"}
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={startGame}
              className="h-8 text-xs border-slate-700 text-slate-300 bg-slate-950/80 hover:bg-slate-800 hover:text-white cursor-pointer rounded-xl flex items-center gap-1"
            >
              <RotateCcw className="size-3.5" aria-hidden="true" />
              重新開始
            </Button>
          </div>
        </div>

        {/* Score and Stats header inside console */}
        <div className="flex justify-between items-center bg-slate-950 px-4 py-2.5 rounded-xl border border-slate-800 mb-4 select-none">
          <div className="flex items-center gap-2 text-rose-500 font-bold text-xs sm:text-sm">
            <Shield className="size-4 animate-pulse" aria-hidden="true" />
            <span>生命值: {hp}</span>
          </div>
          <div className="flex items-center gap-2 text-indigo-400 font-bold text-xs sm:text-sm">
            <Coins className="size-4" aria-hidden="true" />
            <span>得分: {score}</span>
          </div>
          <div className="flex items-center gap-2 text-amber-500 font-bold text-xs sm:text-sm">
            <Sparkles className="size-4" aria-hidden="true" />
            <span>最高紀錄: {highScore}</span>
          </div>
        </div>

        {/* Screen canvas wrapper */}
        <div 
          ref={canvasContainerRef}
          className={
            isFullscreen
              ? "fixed inset-0 w-screen h-screen bg-black flex items-center justify-center z-50 border-0 rounded-none select-none"
              : "relative aspect-[16/9] w-full bg-slate-950 rounded-2xl border border-slate-800/80 overflow-hidden flex items-center justify-center shadow-inner"
          }
        >
          {/* Floating Fullscreen button inside game screen */}
          <Button
            variant="outline"
            size="icon"
            onClick={toggleFullscreen}
            className="absolute top-4 right-4 z-30 size-9 rounded-xl border-slate-700 text-slate-400 bg-slate-900/80 hover:bg-slate-800 hover:text-white cursor-pointer backdrop-blur-sm shadow-md"
            aria-label="切換全螢幕"
          >
            {isFullscreen ? <Minimize2 className="size-4" aria-hidden="true" /> : <Maximize2 className="size-4" aria-hidden="true" />}
          </Button>
          {hp > 0 ? (
            <canvas 
              ref={canvasEl} 
              width={GAME_WIDTH} 
              height={GAME_HEIGHT}
              className="w-full h-full block cursor-crosshair"
              data-testid="game-canvas"
            />
          ) : (
            <div 
              className="absolute inset-0 flex flex-col justify-center items-center bg-black/80 z-20 cursor-pointer animate-fade-in group"
              onClick={startGame}
              data-testid="gameover-screen"
            >
              <Gamepad2 className="size-16 text-rose-500 mb-4 animate-bounce group-hover:scale-110 transition-transform" aria-hidden="true" />
              <div className="text-4xl sm:text-5xl font-black text-rose-600 uppercase tracking-widest select-none">
                Game Over
              </div>
              <p className="text-slate-400 text-xs sm:text-sm mt-3 animate-pulse">
                點擊任意處重新挑戰
              </p>
              <Button 
                variant="outline"
                className="mt-6 border-rose-500/50 hover:bg-rose-500/20 text-rose-400 font-bold rounded-xl cursor-pointer"
                onClick={(e) => {
                  e.stopPropagation()
                  startGame()
                }}
              >
                <RotateCcw className="mr-2 size-4" aria-hidden="true" />
                重新開始
              </Button>
            </div>
          )}
        </div>

        {/* Controller Overlay for touchscreens */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-6 mt-6 p-4 rounded-2xl bg-slate-950 border border-slate-800 shadow-inner">
          {/* Mobile D-pad */}
          <div className="flex items-center gap-4">
            <div className="grid grid-cols-3 gap-1.5 size-36 shrink-0 select-none">
              <div />
              <Button
                variant="outline"
                size="icon"
                className="size-11 rounded-xl border-purple-500/50 dark:border-purple-400/50 text-slate-100 dark:text-slate-100 hover:text-white bg-slate-900/90 hover:bg-purple-600/30 cursor-pointer shadow-md shadow-purple-500/10 active:scale-95 transition-all"
                onMouseDown={() => { stateRef.current.key.up = true }}
                onMouseUp={() => { stateRef.current.key.up = false }}
                onTouchStart={(e) => { e.preventDefault(); stateRef.current.key.up = true }}
                onTouchEnd={(e) => { e.preventDefault(); stateRef.current.key.up = false }}
                aria-label="戰機向上移動"
              >
                <ArrowUp className="size-5" aria-hidden="true" />
              </Button>
              <div />
              <Button
                variant="outline"
                size="icon"
                className="size-11 rounded-xl border-purple-500/50 dark:border-purple-400/50 text-slate-100 dark:text-slate-100 hover:text-white bg-slate-900/90 hover:bg-purple-600/30 cursor-pointer shadow-md shadow-purple-500/10 active:scale-95 transition-all"
                onMouseDown={() => { stateRef.current.key.left = true }}
                onMouseUp={() => { stateRef.current.key.left = false }}
                onTouchStart={(e) => { e.preventDefault(); stateRef.current.key.left = true }}
                onTouchEnd={(e) => { e.preventDefault(); stateRef.current.key.left = false }}
                aria-label="戰機向左移動"
              >
                <ArrowLeft className="size-5" aria-hidden="true" />
              </Button>
              <div className="flex items-center justify-center text-[11px] text-slate-500 font-extrabold uppercase select-none">
                D-Pad
              </div>
              <Button
                variant="outline"
                size="icon"
                className="size-11 rounded-xl border-purple-500/50 dark:border-purple-400/50 text-slate-100 dark:text-slate-100 hover:text-white bg-slate-900/90 hover:bg-purple-600/30 cursor-pointer shadow-md shadow-purple-500/10 active:scale-95 transition-all"
                onMouseDown={() => { stateRef.current.key.right = true }}
                onMouseUp={() => { stateRef.current.key.right = false }}
                onTouchStart={(e) => { e.preventDefault(); stateRef.current.key.right = true }}
                onTouchEnd={(e) => { e.preventDefault(); stateRef.current.key.right = false }}
                aria-label="戰機向右移動"
              >
                <ArrowRight className="size-5" aria-hidden="true" />
              </Button>
              <div />
              <Button
                variant="outline"
                size="icon"
                className="size-11 rounded-xl border-purple-500/50 dark:border-purple-400/50 text-slate-100 dark:text-slate-100 hover:text-white bg-slate-900/90 hover:bg-purple-600/30 cursor-pointer shadow-md shadow-purple-500/10 active:scale-95 transition-all"
                onMouseDown={() => { stateRef.current.key.down = true }}
                onMouseUp={() => { stateRef.current.key.down = false }}
                onTouchStart={(e) => { e.preventDefault(); stateRef.current.key.down = true }}
                onTouchEnd={(e) => { e.preventDefault(); stateRef.current.key.down = false }}
                aria-label="戰機向下移動"
              >
                <ArrowDown className="size-5" aria-hidden="true" />
              </Button>
              <div />
            </div>
            
            <div className="text-left text-xs text-slate-500 max-w-[200px] select-none hidden sm:block">
              <h5 className="font-bold text-slate-400 mb-1">鍵盤控制指南</h5>
              <p>移動：W A S D / 方向鍵</p>
              <p>開火：空白鍵 (Space)</p>
            </div>
          </div>

          {/* Action Button */}
          <div className="flex flex-col items-center gap-2">
            <Button
              variant="default"
              className="w-28 h-12 rounded-2xl bg-gradient-to-r from-pink-500 via-purple-600 to-indigo-600 hover:from-pink-600 hover:via-purple-700 hover:to-indigo-700 active:scale-95 text-white font-extrabold shadow-lg shadow-purple-500/30 border border-purple-400/20 shrink-0 cursor-pointer"
              onClick={() => {
                const s = stateRef.current
                s.bow.push({ x: 15 + s.x, y: s.y + s.w / 2 })
              }}
              aria-label="發射鐳射"
            >
              FIRE (A)
            </Button>
            <span className="text-[10px] text-slate-500 font-medium select-none">點擊按鈕或按空白鍵發射</span>
          </div>
        </div>
      </div>

      {/* Help Modal */}
      {showInstructions && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 max-w-sm w-full shadow-2xl animate-scale-in text-slate-100">
            <div className="flex items-center gap-3 mb-4">
              <Gamepad2 className="h-6 w-6 text-purple-400" aria-hidden="true" />
              <h3 className="text-lg font-bold text-white">復古射擊 遊戲說明</h3>
            </div>
            
            <div className="space-y-3.5 text-xs text-slate-300">
              <p className="leading-relaxed">
                這是一款復古風格的太空射擊小遊戲，考驗您的反應能力。
              </p>
              <div className="flex justify-between items-center border-b border-slate-800 pb-2">
                <span>移動戰機</span>
                <kbd className="px-2 py-0.5 rounded bg-slate-950 text-purple-400 border border-slate-800 font-mono">W A S D / ↑ ↓ ← →</kbd>
              </div>
              <div className="flex justify-between items-center border-b border-slate-800 pb-2">
                <span>開火發射</span>
                <kbd className="px-2 py-0.5 rounded bg-slate-950 text-purple-400 border border-slate-800 font-mono">空白鍵 (Space)</kbd>
              </div>
              <div className="flex justify-between items-center border-b border-slate-800 pb-2">
                <span>暫停 / 繼續</span>
                <kbd className="px-2 py-0.5 rounded bg-slate-950 text-purple-400 border border-slate-800 font-mono">Esc 或 P 鍵</kbd>
              </div>
              <div className="text-[11px] text-slate-400 bg-slate-950/40 p-3 rounded-lg border border-slate-800/40 leading-normal">
                <span className="font-bold text-rose-500 block mb-1">⚠️ 遊戲規則</span>
                避開或擊碎迎面而來的紅色障礙物。若紅色障礙物突破最左側防線，生命值將會扣減 1 點。生命值歸零則遊戲結束。
              </div>
            </div>
            
            <div className="mt-6 flex justify-end">
              <Button 
                onClick={() => setShowInstructions(false)}
                className="bg-purple-600 hover:bg-purple-700 text-white font-semibold cursor-pointer"
              >
                開始遊戲
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default MiniGame
