import { useEffect, useState, useRef } from 'react'
import { clsx } from 'clsx'
import { AlertTriangle, HelpCircle, Maximize2, Minimize2, Pause, Play, RotateCcw } from 'lucide-react'
import { Button, StatTile } from '@/components/toybox'
import { ControllerPad, GameDialog, GamePageHead, KeyRow, ScreenIconButton, TipBar } from '@/pages/RpgRoom/lib/gameUi'
import '@/pages/MiniGame/MiniGame.css'
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

  const togglePause = () => {
    const s = stateRef.current
    if (hp > 0) {
      setIsPaused((prev) => {
        const val = !prev
        s.isPaused = val
        return val
      })
    }
  }

  // D-pad：按住移動、放開停止（滑鼠與觸控）
  const dirProps = (dir: 'up' | 'down' | 'left' | 'right') => ({
    onMouseDown: () => { stateRef.current.key[dir] = true },
    onMouseUp: () => { stateRef.current.key[dir] = false },
    onTouchStart: (e: React.TouchEvent) => { e.preventDefault(); stateRef.current.key[dir] = true },
    onTouchEnd: (e: React.TouchEvent) => { e.preventDefault(); stateRef.current.key[dir] = false },
  })

  return (
    <div className="tb-container mini-page" data-testid="page-minigame">
      <div className="mini-col">
        <GamePageHead
          eyebrow="— MINI GAME —"
          title="復古射擊小遊戲"
          intro="使用方向鍵控制戰機，空白鍵發射光子束消滅紅色障礙。躲避或擊毀它們，別讓障礙突破防線！"
        />

        {/* 工具列 */}
        <div className="flex flex-wrap items-center gap-3 select-none">
          <Button size="s" icon={<HelpCircle strokeWidth={2.5} aria-hidden="true" />} onClick={() => setShowInstructions(true)}>
            遊戲說明
          </Button>
          <Button size="s" icon={isPaused ? <Play strokeWidth={2.5} aria-hidden="true" /> : <Pause strokeWidth={2.5} aria-hidden="true" />} onClick={togglePause}>
            {isPaused ? '繼續遊戲' : '暫停遊戲'}
          </Button>
          <Button size="s" icon={<RotateCcw strokeWidth={2.5} aria-hidden="true" />} onClick={startGame}>
            重新開始
          </Button>
        </div>

        {/* 計分列 */}
        <div className="mini-stats">
          <StatTile value={hp} label="生命值" />
          <StatTile value={score} label="得分" />
          <StatTile value={highScore} label="最高紀錄" />
        </div>

        {/* 遊戲畫面外框（ScreenFrame 結構；畫面區要掛 ref 給全螢幕，故直接寫 tb-screen） */}
        <div className="tb-screen">
          <div className="tb-screen__bar">
            <span className="tb-screen__title">MINI GAME</span>
            <span className="tb-screen__meta">CANVAS 2D</span>
          </div>
          <div
            ref={canvasContainerRef}
            className={clsx('tb-screen__view', isFullscreen ? 'mini-screen__view--full' : 'mini-screen__view')}
          >
            <ScreenIconButton
              icon={isFullscreen ? <Minimize2 strokeWidth={2.5} aria-hidden="true" /> : <Maximize2 strokeWidth={2.5} aria-hidden="true" />}
              label="切換全螢幕"
              onClick={toggleFullscreen}
              className="absolute top-4 right-4 z-30"
            />
            {hp > 0 ? (
              <canvas
                ref={canvasEl}
                width={GAME_WIDTH}
                height={GAME_HEIGHT}
                className="block h-full w-full cursor-crosshair"
                data-testid="game-canvas"
              />
            ) : (
              <div
                className="absolute inset-0 z-20 flex cursor-pointer flex-col items-center justify-center gap-4 bg-inverse/85 select-none tb-on-inverse"
                onClick={startGame}
                data-testid="gameover-screen"
              >
                <div className="font-pixel text-pixel-xl text-pop">GAME OVER</div>
                <p className="text-body-s text-on-inverse-muted">點擊任意處重新挑戰</p>
                <Button
                  variant="pop"
                  icon={<RotateCcw strokeWidth={2.5} aria-hidden="true" />}
                  onClick={(e) => {
                    e.stopPropagation()
                    startGame()
                  }}
                >
                  重新開始
                </Button>
              </div>
            )}
          </div>
        </div>

        {/* 控制器面板 */}
        <ControllerPad
          dirProps={dirProps}
          dirLabel={(d) => `戰機向${d}移動`}
          keyboardTitle="鍵盤控制指南"
          keyboardLines={['移動：W A S D / 方向鍵', '開火：空白鍵 (Space)']}
          actionText="FIRE (A)"
          actionLabel="發射鐳射"
          actionHint="點擊按鈕或按空白鍵發射"
          onAction={() => {
            const s = stateRef.current
            s.bow.push({ x: 15 + s.x, y: s.y + s.w / 2 })
          }}
        />
      </div>

      {/* 說明對話框 */}
      {showInstructions && (
        <GameDialog fixed title="復古射擊 遊戲說明" primaryLabel="開始遊戲" onClose={() => setShowInstructions(false)}>
          <p className="text-body text-ink">這是一款復古風格的太空射擊小遊戲，考驗您的反應能力。</p>
          <div className="flex flex-col">
            <KeyRow label="移動戰機" keys="W A S D / ↑ ↓ ← →" />
            <KeyRow label="開火發射" keys="空白鍵 (Space)" />
            <KeyRow label="暫停 / 繼續" keys="Esc 或 P 鍵" />
          </div>
          <TipBar icon={<AlertTriangle strokeWidth={2.5} aria-hidden="true" />}>
            <span className="block font-bold">遊戲規則</span>
            避開或擊碎迎面而來的紅色障礙物。若紅色障礙物突破最左側防線，生命值將會扣減 1 點。生命值歸零則遊戲結束。
          </TipBar>
        </GameDialog>
      )}
    </div>
  )
}

export default MiniGame
