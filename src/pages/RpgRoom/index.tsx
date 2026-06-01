import { useEffect, useState, useRef, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { 
  Gamepad2, 
  HelpCircle, 
  Info, 
  X, 
  ArrowUp, 
  ArrowDown, 
  ArrowLeft, 
  ArrowRight,
  Compass,
  MessageSquare,
  Maximize2,
  Minimize2
} from 'lucide-react'
import { useRpgStore } from '@/store/useRpgStore'
import { isMoveObject } from '@/pages/RpgRoom/constants/isMove'
import { messageObject } from '@/pages/RpgRoom/constants/message'

interface PlayerRefState {
  px: number
  py: number
  sx: number
  sy: number
  s: number
  left: boolean
  right: boolean
  up: boolean
  down: boolean
}

export function RpgRoom() {
  const {
    mapId,
    isTransSence,
    isChat,
    npcName,
    npcMessage,
    setTransSence,
    setMap,
    setNpcChat,
    closeChat,
    resetRpg,
  } = useRpgStore()

  const [showInstructions, setShowInstructions] = useState(false)
  const [imagesLoaded, setImagesLoaded] = useState(false)

  // Canvas refs
  const canvasContainerRef = useRef<HTMLDivElement>(null)
  const bgCanvasRef = useRef<HTMLCanvasElement>(null)
  const playerCanvasRef = useRef<HTMLCanvasElement>(null)
  const fgCanvasRef = useRef<HTMLCanvasElement>(null)

  const [isFullscreen, setIsFullscreen] = useState(false)

  // Animation and state refs
  const requestRef = useRef<number | null>(null)
  const animationFrameRef = useRef<number>(0)
  const isTransSenceRef = useRef<boolean>(true)
  const mapIdRef = useRef<number>(0)

  // Assets refs
  const playerImageRef = useRef<HTMLImageElement | null>(null)
  const bgImageRef = useRef<HTMLImageElement | null>(null)
  const fgImageRef = useRef<HTMLImageElement | null>(null)

  // Player position and keys
  const playerRef = useRef<PlayerRefState>({
    px: 1000,
    py: 600,
    sx: 0,
    sy: 0,
    s: 4,
    left: false,
    right: false,
    up: false,
    down: false,
  })

  // Camera follow logic
  const updateCamera = (
    px: number,
    py: number,
    id: number,
    w: number,
    h: number
  ) => {
    const mapConfig = isMoveObject[id].map
    const senceWidth = mapConfig.width
    const senceHeight = mapConfig.height

    const nX = 32
    const nY = 48

    // Camera bounding padding (middle 50% of the viewport)
    const mh = h / 4
    const mw = w / 4
    const mDw = Math.floor((h / 2) + (mh - nY)) - (Math.floor((h / 2) + (mh - nY)) % 4)
    const mRf = Math.floor((w / 2) + (mw - nX)) - (Math.floor((w / 2) + (mw - nX)) % 4)

    let msx: number
    if (w > senceWidth || px <= mRf) {
      msx = 0
    } else if (px >= senceWidth - nX || (px - mRf) > (senceWidth - w)) {
      msx = senceWidth - w
    } else {
      msx = px - mRf
    }

    let msy: number
    if (h > senceHeight || py <= mDw) {
      msy = 0
    } else if (py >= senceHeight - nY || (py - mDw) > (senceHeight - h)) {
      msy = senceHeight - h
    } else {
      msy = py - mDw
    }

    let spx: number
    if (w > senceWidth) {
      spx = px + ((w - senceWidth) / 2)
    } else if (px <= mRf) {
      spx = px
    } else if (px >= senceWidth - nX || (px - mRf) > (senceWidth - w)) {
      spx = px - msx
    } else {
      spx = mRf
    }

    let spy: number
    if (h > senceHeight) {
      spy = py + ((h - senceHeight) / 2)
    } else if (py <= mDw) {
      spy = py
    } else if (py >= senceHeight - nY || (py - mDw) > (senceHeight - h)) {
      spy = py - msy
    } else {
      spy = mDw
    }

    return { msx, msy, spx, spy }
  }


  // Preloading map graphics
  const loadMapImages = (id: number): Promise<void> => {
    return new Promise((resolve) => {
      let loadedCount = 0
      const checkResolve = () => {
        loadedCount++
        if (loadedCount === 2) {
          resolve()
        }
      }

      const bgImg = new Image()
      bgImg.onload = checkResolve
      bgImg.onerror = checkResolve
      bgImg.src = isMoveObject[id].map.second
      bgImageRef.current = bgImg

      const fgImg = new Image()
      fgImg.onload = checkResolve
      fgImg.onerror = checkResolve
      fgImg.src = isMoveObject[id].map.first
      fgImageRef.current = fgImg
    })
  }

  // Draw cycle
  const drawGame = useCallback(() => {
    const container = canvasContainerRef.current
    if (!container) return

    const bgCanvas = bgCanvasRef.current
    const playerCanvas = playerCanvasRef.current
    const fgCanvas = fgCanvasRef.current

    if (!bgCanvas || !playerCanvas || !fgCanvas) return

    const bgCtx = bgCanvas.getContext('2d')
    const playerCtx = playerCanvas.getContext('2d')
    const fgCtx = fgCanvas.getContext('2d')

    if (!bgCtx || !playerCtx || !fgCtx) return

    const w = container.clientWidth
    const h = container.clientHeight

    // Keep resolutions matched to layout client pixels
    if (bgCanvas.width !== w || bgCanvas.height !== h) {
      bgCanvas.width = w
      bgCanvas.height = h
      playerCanvas.width = w
      playerCanvas.height = h
      fgCanvas.width = w
      fgCanvas.height = h
    }

    const p = playerRef.current
    const id = mapIdRef.current
    const mapConfig = isMoveObject[id].map

    const { msx, msy, spx, spy } = updateCamera(p.px, p.py, id, w, h)

    // Clear frames
    bgCtx.clearRect(0, 0, w, h)
    playerCtx.clearRect(0, 0, w, h)
    fgCtx.clearRect(0, 0, w, h)

    // Render background map layer
    if (bgImageRef.current && bgImageRef.current.complete) {
      const sWidth = Math.min(w, mapConfig.width)
      const sHeight = Math.min(h, mapConfig.height)
      const dx = w > mapConfig.width ? (w - mapConfig.width) / 2 : 0
      const dy = h > mapConfig.height ? (h - mapConfig.height) / 2 : 0

      bgCtx.drawImage(
        bgImageRef.current,
        msx,
        msy,
        sWidth,
        sHeight,
        dx,
        dy,
        sWidth,
        sHeight
      )
    }

    // Render player
    if (playerImageRef.current && playerImageRef.current.complete) {
      const nX = 32
      const nY = 48
      playerCtx.drawImage(
        playerImageRef.current,
        p.sx,
        p.sy,
        nX,
        nY,
        spx,
        spy,
        nX,
        nY
      )
    }

    // Render foreground overlay layer
    if (fgImageRef.current && fgImageRef.current.complete) {
      const sWidth = Math.min(w, mapConfig.width)
      const sHeight = Math.min(h, mapConfig.height)
      const dx = w > mapConfig.width ? (w - mapConfig.width) / 2 : 0
      const dy = h > mapConfig.height ? (h - mapConfig.height) / 2 : 0

      fgCtx.drawImage(
        fgImageRef.current,
        msx,
        msy,
        sWidth,
        sHeight,
        dx,
        dy,
        sWidth,
        sHeight
      )
    }
  }, [])

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(document.fullscreenElement === canvasContainerRef.current)
      setTimeout(() => {
        drawGame()
      }, 50)
    }
    document.addEventListener('fullscreenchange', handleFullscreenChange)
    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange)
    }
  }, [drawGame])

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

  // Triggering map scene transition
  const triggerSceneTransition = (targetMapId: number, spawnIndex: number) => {
    isTransSenceRef.current = true
    setMap(targetMapId, true)

    // Update coordinates immediately
    const targetSpawn = isMoveObject[targetMapId].map.in[spawnIndex]
    playerRef.current.px = targetSpawn.x
    playerRef.current.py = targetSpawn.y

    loadMapImages(targetMapId).then(() => {
      mapIdRef.current = targetMapId
      drawGame()
      // Brief timeout to let player view the fade screen
      setTimeout(() => {
        isTransSenceRef.current = false
        setTransSence(false)
      }, 500)
    })
  }

  // Dialogue check
  const handleInteract = () => {
    const p = playerRef.current
    const id = mapIdRef.current
    const nX = 32
    const nY = 48
    const speed = p.s

    // Detect tile coordinates directly facing the player
    let checkOffset = { x: 0, y: 0 }
    switch (p.sy) {
      case 0: // down
        checkOffset = { x: 0, y: speed }
        break
      case 48: // left
        checkOffset = { x: -speed, y: 0 }
        break
      case 96: // right
        checkOffset = { x: speed, y: 0 }
        break
      case 144: // up
        checkOffset = { x: 0, y: -speed }
        break
    }

    const { x, y } = checkOffset
    let npcFound = false

    isMoveObject[id].isMove.forEach((json) => {
      const a = p.px + nX + x >= json.x
      const b = p.px + x <= json.x + json.w
      const c = p.py + nY + y >= json.y
      const d = p.py + y <= json.y + json.h

      if (a && b && c && d) {
        if (json.e !== undefined && json.e >= 0) {
          npcFound = true
          const npcJson = messageObject[id][json.e]
          if (npcJson && npcJson.text) {
            const currentCount = useRpgStore.getState().messageCount
            const nextCount = currentCount + 1

            if (nextCount <= npcJson.text.length) {
              setNpcChat({
                isChat: true,
                npcName: npcJson.name,
                npcMessage: npcJson.text[nextCount - 1],
                messageCount: nextCount,
              })
            } else {
              closeChat()
            }
          }
        }
      }
    })

    if (!npcFound) {
      if (useRpgStore.getState().isChat) {
        closeChat()
      }
    }
  }

  // Game loop tick
  const loop = () => {
    if (!canvasContainerRef.current) return
    if (isTransSenceRef.current) {
      // Keep scheduling drawing frames during loading fades
      drawGame()
      requestRef.current = requestAnimationFrame(loop)
      return
    }

    const p = playerRef.current
    const id = mapIdRef.current
    const speed = p.s

    let dx = 0
    let dy = 0
    let isMovingX = false
    let isMovingY = false

    const nX = 32
    const nY = 48

    if (p.left && !p.right) {
      dx = -speed
      p.sy = nY
      isMovingX = true
    } else if (p.right && !p.left) {
      dx = speed
      p.sy = nY * 2
      isMovingX = true
    }

    if (p.up && !p.down) {
      dy = -speed
      p.sy = nY * 3
      isMovingY = true
    } else if (p.down && !p.up) {
      dy = speed
      p.sy = 0
      isMovingY = true
    }

    if (isMovingX || isMovingY) {
      const nextPx = p.px + dx
      const nextPy = p.py + dy

      const canMove = (chkX: number, chkY: number) => {
        let possible = true
        isMoveObject[id].isMove.forEach((json) => {
          const a = chkX + nX >= json.x
          const b = chkX <= json.x + json.w
          const c = chkY + nY >= json.y
          const d = chkY <= json.y + json.h
          if (a && b && c && d) {
            possible = false
          }
        })
        return possible
      }

      const checkTransition = (chkX: number, chkY: number) => {
        let transitioned = false
        isMoveObject[id].isMove.forEach((json) => {
          const a = chkX + nX >= json.x
          const b = chkX <= json.x + json.w
          const c = chkY + nY >= json.y
          const d = chkY <= json.y + json.h
          if (a && b && c && d) {
            if (json.cm !== undefined && json.cm >= 0 && json.cmm !== undefined && json.cmm >= 0) {
              transitioned = true
              triggerSceneTransition(json.cm, json.cmm)
            }
          }
        })
        return transitioned
      }

      if (!checkTransition(nextPx, nextPy)) {
        if (canMove(nextPx, nextPy)) {
          p.px = nextPx
          p.py = nextPy
        } else if (isMovingX && isMovingY && canMove(nextPx, p.py)) {
          p.px = nextPx
        } else if (isMovingX && isMovingY && canMove(p.px, nextPy)) {
          p.py = nextPy
        }

        // Walk frame slices cycle
        animationFrameRef.current = (animationFrameRef.current + 1) % nX
        p.sx = Math.floor(animationFrameRef.current / (nX / 4)) * nX
      }

      if (useRpgStore.getState().isChat) {
        closeChat()
      }
    }

    drawGame()
    requestRef.current = requestAnimationFrame(loop)
  }

  // Keyboard handlers
  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.keyCode === 27) {
      e.preventDefault()
      setShowInstructions((prev) => !prev)
      return
    }

    if ([32, 37, 38, 39, 40].includes(e.keyCode)) {
      e.preventDefault()
    }

    // Support WASD and Arrow Keys
    const p = playerRef.current
    switch (e.keyCode) {
      case 37:
      case 65: // A
        p.left = true
        break
      case 38:
      case 87: // W
        p.up = true
        break
      case 39:
      case 68: // D
        p.right = true
        break
      case 40:
      case 83: // S
        p.down = true
        break
      case 32: // Space -> Action
      case 13: // Enter -> Action
        handleInteract()
        break
    }
  }

  const handleKeyUp = (e: KeyboardEvent) => {
    if ([37, 38, 39, 40, 65, 87, 68, 83].includes(e.keyCode)) {
      e.preventDefault()
    }

    const p = playerRef.current
    switch (e.keyCode) {
      case 37:
      case 65:
        p.left = false
        break
      case 38:
      case 87:
        p.up = false
        break
      case 39:
      case 68:
        p.right = false
        break
      case 40:
      case 83:
        p.down = false
        break
    }
  }

  // Initialize RPG room assets on mount
  useEffect(() => {
    resetRpg()
    mapIdRef.current = 0
    isTransSenceRef.current = true

    // Initialize player starting point
    const spawn = isMoveObject[0].map.in[0]
    playerRef.current.px = spawn.x
    playerRef.current.py = spawn.y
    playerRef.current.left = false
    playerRef.current.right = false
    playerRef.current.up = false
    playerRef.current.down = false
    playerRef.current.sx = 0
    playerRef.current.sy = 0

    // Load assets
    const charImg = new Image()
    charImg.onload = () => {
      playerImageRef.current = charImg
      loadMapImages(0).then(() => {
        setImagesLoaded(true)
        isTransSenceRef.current = false
        setTransSence(false)
        drawGame()
      })
    }
    charImg.src = import.meta.env.BASE_URL + 'rpg/man.png'

    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('keyup', handleKeyUp)

    // Start tick loops
    requestRef.current = requestAnimationFrame(loop)

    // Resize event listener for responsive camera
    const handleResize = () => {
      drawGame()
    }
    window.addEventListener('resize', handleResize)

    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('keyup', handleKeyUp)
      window.removeEventListener('resize', handleResize)
      if (requestRef.current) {
        cancelAnimationFrame(requestRef.current)
      }
      closeChat()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div className="max-w-5xl mx-auto pb-12" data-testid="page-rpgroom">
      {/* Title Header */}
      <header className="text-center mb-8">
        <h1 className="text-3xl md:text-5xl font-extrabold bg-gradient-to-r from-slate-900 via-slate-700 to-slate-500 dark:from-white dark:via-slate-200 dark:to-slate-400 bg-clip-text text-transparent leading-tight">
          RPG 遊戲室
        </h1>
        <p className="mt-3 text-sm md:text-base text-slate-600 dark:text-slate-400 max-w-2xl mx-auto leading-relaxed">
          以經典 2D RPG 角色扮演大師風格實作的個人虛擬展間。探索地圖並與地标/NPC進行對話互動。
        </p>
      </header>

      {/* Arcade cabinet wrapper */}
      <div className="rpg-cabinet">
        {/* Game console screen */}
        <div 
          ref={canvasContainerRef} 
          className={
            isFullscreen 
              ? "fixed inset-0 w-screen h-screen bg-black flex items-center justify-center z-50 border-0 rounded-none select-none" 
              : "rpg-screen"
          }
        >
          {imagesLoaded && (
            <>
              {/* Background layer */}
              <canvas ref={bgCanvasRef} className="rpg-canvas z-[1]" />
              {/* Player layer */}
              <canvas ref={playerCanvasRef} className="rpg-canvas z-[2]" />
              {/* Foreground Overlay layer */}
              <canvas ref={fgCanvasRef} className="rpg-canvas z-[3]" />
            </>
          )}

          {/* Fade transition black screen overlay */}
          {isTransSence && (
            <div className="absolute inset-0 bg-black flex flex-col justify-center items-center z-50 animate-fade-in transition-opacity duration-300">
              <Compass className="size-12 text-purple-500 animate-spin mb-4" />
              <div className="text-white text-base tracking-widest animate-pulse font-mono font-bold select-none">
                載入中請稍後...
              </div>
            </div>
          )}

          {/* Dialogue Box */}
          {isChat && (
            <div className="rpg-chat-box select-text cursor-default" data-testid="rpg-dialogue-box">
              <div className="font-extrabold text-amber-300 dark:text-amber-400 mb-1 flex items-center gap-1.5 border-b border-white/20 pb-1 text-base select-none">
                <MessageSquare className="size-4 shrink-0" />
                <span>{npcName}</span>
              </div>
              <div className="font-medium pr-6 min-h-[3.5em]">
                {npcMessage}
              </div>
              <div className="absolute bottom-2.5 right-4 flex items-center text-[10px] text-white/50 tracking-wider font-semibold animate-pulse select-none">
                <span>按 SPACE / 點 A 繼續</span>
                <span className="ml-1">▼</span>
              </div>
            </div>
          )}

          {/* Instruction Panel overlay */}
          {showInstructions && (
            <div className="absolute inset-0 bg-slate-950/90 z-40 flex flex-col justify-center items-center p-6 text-slate-100 animate-fade-in">
              <div className="max-w-md w-full bg-slate-900 border border-slate-800 p-6 rounded-2xl relative shadow-2xl">
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute top-3 right-3 text-slate-400 hover:text-white rounded-lg cursor-pointer"
                  onClick={() => setShowInstructions(false)}
                  aria-label="關閉說明"
                >
                  <X className="size-5" />
                </Button>
                
                <h3 className="text-xl font-bold text-center border-b border-slate-800 pb-3 mb-4 flex items-center justify-center gap-2">
                  <Gamepad2 className="size-6 text-purple-500" />
                  操作說明指南
                </h3>

                <div className="space-y-4 text-sm leading-relaxed">
                  <div className="flex justify-between items-center bg-slate-950/50 p-2.5 rounded-lg border border-slate-800/50">
                    <span className="font-semibold text-slate-300">移動角色</span>
                    <span className="text-right text-xs bg-slate-800 px-2 py-1 rounded shadow-sm text-purple-400 font-mono">
                      W A S D / 方向鍵
                    </span>
                  </div>
                  <div className="flex justify-between items-center bg-slate-950/50 p-2.5 rounded-lg border border-slate-800/50">
                    <span className="font-semibold text-slate-300">對話/互動</span>
                    <span className="text-right text-xs bg-slate-800 px-2 py-1 rounded shadow-sm text-purple-400 font-mono">
                      SPACE / ENTER / A 按鈕
                    </span>
                  </div>
                  <div className="flex justify-between items-center bg-slate-950/50 p-2.5 rounded-lg border border-slate-800/50">
                    <span className="font-semibold text-slate-300">開啟本選單</span>
                    <span className="text-right text-xs bg-slate-800 px-2 py-1 rounded shadow-sm text-purple-400 font-mono">
                      ESC 鍵
                    </span>
                  </div>
                  <div className="bg-purple-950/30 text-purple-200 p-3 rounded-lg border border-purple-900/30 text-xs mt-4 leading-normal">
                    <span className="font-bold block mb-1">💡 小訣竅</span>
                    走到特定的門口、樓梯或地圖邊界會自動切換地圖。面向告示牌、稻草人或NPC按對話鍵即可觸發交談。
                  </div>
                </div>

                <Button
                  className="w-full mt-6 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white font-bold rounded-xl cursor-pointer"
                  onClick={() => setShowInstructions(false)}
                >
                  開始遊戲
                </Button>
              </div>
            </div>
          )}

          {/* Floating Fullscreen button on upper-right screen */}
          <Button
            variant="outline"
            size="icon"
            className={`absolute top-4 z-30 size-9 rounded-xl border-slate-700 text-slate-400 bg-slate-900/80 hover:bg-slate-800 hover:text-white cursor-pointer backdrop-blur-sm shadow-md animate-fade-in ${isFullscreen ? 'right-4' : 'right-15'}`}
            onClick={toggleFullscreen}
            aria-label="切換全螢幕"
          >
            {isFullscreen ? <Minimize2 className="size-4" /> : <Maximize2 className="size-4" />}
          </Button>

          {/* Floating Instructions HUD button on upper-right screen */}
          {!isFullscreen && (
            <Button
              variant="outline"
              size="icon"
              className="absolute top-4 right-4 z-30 size-9 rounded-xl border-slate-700 text-slate-400 bg-slate-900/80 hover:bg-slate-800 hover:text-white cursor-pointer backdrop-blur-sm"
              onClick={() => setShowInstructions(true)}
              aria-label="打開操作說明"
            >
              <HelpCircle className="size-4" />
            </Button>
          )}

          {/* Info HUD display on upper-left screen showing current map info */}
          <div className="absolute top-4 left-4 z-30 flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-700 bg-slate-900/80 text-slate-300 font-mono text-xs select-none backdrop-blur-sm">
            <Info className="size-3.5 text-purple-400" />
            <span>地圖: {isMoveObject[mapId]?.map?.name || '加載中'}</span>
          </div>
        </div>

        {/* Controllers Panel for dual interfaces */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-6 mt-6 p-4 rounded-2xl bg-slate-950 border border-slate-800 shadow-inner">
          
          {/* Touch D-pad control block */}
          <div className="flex items-center gap-4">
            <div className="grid grid-cols-3 gap-1.5 size-36 shrink-0 select-none">
              <div />
              <Button
                variant="outline"
                size="icon"
                className="size-11 rounded-xl border-purple-500/50 dark:border-purple-400/50 text-slate-100 dark:text-slate-100 hover:text-white bg-slate-900/90 hover:bg-purple-600/30 cursor-pointer shadow-md shadow-purple-500/10 active:scale-95 transition-all"
                onMouseDown={() => { playerRef.current.up = true }}
                onMouseUp={() => { playerRef.current.up = false }}
                onTouchStart={(e) => { e.preventDefault(); playerRef.current.up = true }}
                onTouchEnd={(e) => { e.preventDefault(); playerRef.current.up = false }}
                aria-label="向上移動"
              >
                <ArrowUp className="size-5" />
              </Button>
              <div />
              <Button
                variant="outline"
                size="icon"
                className="size-11 rounded-xl border-purple-500/50 dark:border-purple-400/50 text-slate-100 dark:text-slate-100 hover:text-white bg-slate-900/90 hover:bg-purple-600/30 cursor-pointer shadow-md shadow-purple-500/10 active:scale-95 transition-all"
                onMouseDown={() => { playerRef.current.left = true }}
                onMouseUp={() => { playerRef.current.left = false }}
                onTouchStart={(e) => { e.preventDefault(); playerRef.current.left = true }}
                onTouchEnd={(e) => { e.preventDefault(); playerRef.current.left = false }}
                aria-label="向左移動"
              >
                <ArrowLeft className="size-5" />
              </Button>
              <div className="flex items-center justify-center text-[11px] text-slate-500 font-extrabold uppercase select-none">
                D-Pad
              </div>
              <Button
                variant="outline"
                size="icon"
                className="size-11 rounded-xl border-purple-500/50 dark:border-purple-400/50 text-slate-100 dark:text-slate-100 hover:text-white bg-slate-900/90 hover:bg-purple-600/30 cursor-pointer shadow-md shadow-purple-500/10 active:scale-95 transition-all"
                onMouseDown={() => { playerRef.current.right = true }}
                onMouseUp={() => { playerRef.current.right = false }}
                onTouchStart={(e) => { e.preventDefault(); playerRef.current.right = true }}
                onTouchEnd={(e) => { e.preventDefault(); playerRef.current.right = false }}
                aria-label="向右移動"
              >
                <ArrowRight className="size-5" />
              </Button>
              <div />
              <Button
                variant="outline"
                size="icon"
                className="size-11 rounded-xl border-purple-500/50 dark:border-purple-400/50 text-slate-100 dark:text-slate-100 hover:text-white bg-slate-900/90 hover:bg-purple-600/30 cursor-pointer shadow-md shadow-purple-500/10 active:scale-95 transition-all"
                onMouseDown={() => { playerRef.current.down = true }}
                onMouseUp={() => { playerRef.current.down = false }}
                onTouchStart={(e) => { e.preventDefault(); playerRef.current.down = true }}
                onTouchEnd={(e) => { e.preventDefault(); playerRef.current.down = false }}
                aria-label="向下移動"
              >
                <ArrowDown className="size-5" />
              </Button>
              <div />
            </div>

            <div className="text-left text-xs text-slate-500 max-w-[240px] select-none hidden sm:block">
              <h5 className="font-bold text-slate-400 mb-1">鍵盤玩家快捷鍵</h5>
              <p>移動：W A S D / 方向鍵</p>
              <p>互動：空白鍵 (Space) / Enter 鍵</p>
              <p>說明：ESC 鍵</p>
            </div>
          </div>

          {/* Action button block */}
          <div className="flex flex-col items-center gap-2">
            <Button
              variant="default"
              className="w-28 h-12 rounded-2xl bg-gradient-to-r from-pink-500 via-purple-600 to-indigo-600 hover:from-pink-600 hover:via-purple-700 hover:to-indigo-700 active:scale-95 text-white font-extrabold shadow-lg shadow-purple-500/30 border border-purple-400/20 shrink-0 cursor-pointer select-none"
              onClick={handleInteract}
              aria-label="對話互動"
            >
              Action (A)
            </Button>
            <span className="text-[10px] text-slate-500 font-medium select-none">點擊互動或按空白鍵交談</span>
          </div>

        </div>
      </div>
    </div>
  )
}

export default RpgRoom
