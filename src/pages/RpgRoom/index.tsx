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
import tile1Img from '@/assets/images/map-editor/rpg_maker_xp.png'
import tile2Img from '@/assets/images/map-editor/rpg_maker_xp2.png'
import bgImg from '@/assets/images/map-editor/bg.jpg'
import { mapsJson } from '@/pages/RpgRoom/data'
import { aabbIntersect } from '@/pages/RpgRoom/types'
import { renderMessage } from '@/pages/RpgRoom/lib/messageRenderer'


// NPC 碰撞框只取下半身（RPG Maker 慣例：角色可走到 NPC 上方、視覺與其上半身重疊）
const npcFeetBox = (npc: { pX: number; pY: number; w: number; h: number }) => ({
  x: npc.pX,
  y: npc.pY + 24,
  w: npc.w,
  h: npc.h - 24,
})

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
  const [isTouchDevice, setIsTouchDevice] = useState(false)
  const [, setIsPaused] = useState(false)
  const isPausedRef = useRef(false)

  // Canvas refs
  const canvasContainerRef = useRef<HTMLDivElement>(null)
  const bgCanvasRef = useRef<HTMLCanvasElement>(null)
  const playerCanvasRef = useRef<HTMLCanvasElement>(null)
  const fgCanvasRef = useRef<HTMLCanvasElement>(null)
  const coordsRef = useRef<HTMLSpanElement>(null)

  const [isFullscreen, setIsFullscreen] = useState(false)

  // Animation and state refs
  const requestRef = useRef<number | null>(null)
  const animationFrameRef = useRef<number>(0)
  const isTransSenceRef = useRef<boolean>(true)
  const mapIdRef = useRef<number>(0)

  // Assets refs
  const playerImageRef = useRef<HTMLImageElement | null>(null)
  const tile1ImageRef = useRef<HTMLImageElement | null>(null)
  const tile2ImageRef = useRef<HTMLImageElement | null>(null)
  const bgTileImageRef = useRef<HTMLImageElement | null>(null)

  // Offscreen canvas refs
  const bgOffscreenCanvasRef = useRef<HTMLCanvasElement | null>(null)
  const fgOffscreenCanvasRef = useRef<HTMLCanvasElement | null>(null)

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
    const mapConfig = mapsJson[id].map
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


  // Preloading core spritesheets and grass bg
  const preloadCoreAssets = (): Promise<void> => {
    return new Promise((resolve) => {
      let loadedCount = 0
      const totalToLoad = 4
      const checkResolve = () => {
        loadedCount++
        if (loadedCount === totalToLoad) {
          resolve()
        }
      }

      // 1. Player character spritesheet
      const charImg = new Image()
      charImg.onload = checkResolve
      charImg.onerror = checkResolve
      charImg.src = import.meta.env.BASE_URL + 'rpg/man.png'
      playerImageRef.current = charImg

      // 2. Spritesheet tile 1
      const t1Img = new Image()
      t1Img.onload = checkResolve
      t1Img.onerror = checkResolve
      t1Img.src = tile1Img
      tile1ImageRef.current = t1Img

      // 3. Spritesheet tile 2
      const t2Img = new Image()
      t2Img.onload = checkResolve
      t2Img.onerror = checkResolve
      t2Img.src = tile2Img
      tile2ImageRef.current = t2Img

      // 4. Background Grass Tile
      const bgTile = new Image()
      bgTile.onload = checkResolve
      bgTile.onerror = checkResolve
      bgTile.src = bgImg
      bgTileImageRef.current = bgTile
    })
  }

  // Pre-render map JSON into offscreen canvases for drawing performance
  const prepareMapCanvases = (id: number) => {
    const mapJson = mapsJson[id]
    if (!mapJson) return
    const mapConfig = mapJson.map

    if (!bgOffscreenCanvasRef.current) {
      bgOffscreenCanvasRef.current = document.createElement('canvas')
    }
    if (!fgOffscreenCanvasRef.current) {
      fgOffscreenCanvasRef.current = document.createElement('canvas')
    }

    const bgCanvas = bgOffscreenCanvasRef.current
    const fgCanvas = fgOffscreenCanvasRef.current

    bgCanvas.width = mapConfig.width
    bgCanvas.height = mapConfig.height
    fgCanvas.width = mapConfig.width
    fgCanvas.height = mapConfig.height

    const bgCtx = bgCanvas.getContext('2d')
    const fgCtx = fgCanvas.getContext('2d')
    if (!bgCtx || !fgCtx) return

    // 1. Repeat repeating grass tile as the base background
    const bgTile = bgTileImageRef.current
    if (bgTile && bgTile.complete) {
      const tileW = 32
      const tileH = 32
      const cols = Math.ceil(mapConfig.width / tileW)
      const rows = Math.ceil(mapConfig.height / tileH)
      for (let c = 0; c < cols; c++) {
        for (let r = 0; r < rows; r++) {
          bgCtx.drawImage(bgTile, 0, 0, 32, 32, c * tileW, r * tileH, tileW, tileH)
        }
      }
    }

    // 2. Draw map style tiles sequentially on respective canvases
    const IMAGES = [
      playerImageRef.current, // index 0 (manImg - not used for map tiles)
      tile1ImageRef.current,  // index 1 (rpg_maker_xp)
      tile2ImageRef.current,  // index 2 (rpg_maker_xp2)
    ]

    mapJson.styles.forEach((tile) => {
      const sheet = IMAGES[tile.b]
      if (!sheet || !sheet.complete) return

      const ctx = tile.z === 2 ? fgCtx : bgCtx
      // rx/ry 壓縮欄位：同貼圖沿 X/Y 平鋪展開
      const rx = tile.rx ?? 1
      const ry = tile.ry ?? 1
      for (let ix = 0; ix < rx; ix++) {
        for (let iy = 0; iy < ry; iy++) {
          ctx.drawImage(
            sheet,
            tile.x,
            tile.y,
            tile.w,
            tile.h,
            tile.l + ix * tile.w,
            tile.t + iy * tile.h,
            tile.w,
            tile.h
          )
        }
      }
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
    const mapConfig = mapsJson[id].map

    if (coordsRef.current) {
      coordsRef.current.innerText = `X: ${p.px}, Y: ${p.py}`
    }

    const { msx, msy, spx, spy } = updateCamera(p.px, p.py, id, w, h)

    // Clear frames
    bgCtx.clearRect(0, 0, w, h)
    playerCtx.clearRect(0, 0, w, h)
    fgCtx.clearRect(0, 0, w, h)

    // Render background map layer from offscreen cache
    if (bgOffscreenCanvasRef.current) {
      const sWidth = Math.min(w, mapConfig.width)
      const sHeight = Math.min(h, mapConfig.height)
      const dx = w > mapConfig.width ? (w - mapConfig.width) / 2 : 0
      const dy = h > mapConfig.height ? (h - mapConfig.height) / 2 : 0

      bgCtx.drawImage(
        bgOffscreenCanvasRef.current,
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

    // Render characters (Y-sorted: player and NPCs)
    interface RenderableChar {
      y: number
      draw: () => void
    }

    const charsToRender: RenderableChar[] = []
    const nX = 32
    const nY = 48

    // 1. Add player
    if (playerImageRef.current && playerImageRef.current.complete) {
      charsToRender.push({
        y: p.py + nY,
        draw: () => {
          playerCtx.drawImage(
            playerImageRef.current!,
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
      })
    }

    // 2. Add NPCs from map JSON
    const mapJson = mapsJson[id]
    if (mapJson && mapJson.npc) {
      const IMAGES = [
        playerImageRef.current,
        tile1ImageRef.current,
        tile2ImageRef.current,
      ]

      mapJson.npc.forEach((npc) => {
        const npcMsg = mapJson.messages?.[npc.e]
        if (!npcMsg) return // Skip if not an active NPC

        const npcX = npc.pX
        const npcY = npc.pY
        const nW = npc.w || 32
        const nH = npc.h || 48

        let nSpx: number
        if (w > mapConfig.width) {
          nSpx = npcX + ((w - mapConfig.width) / 2)
        } else {
          nSpx = npcX - msx
        }

        let nSpy: number
        if (h > mapConfig.height) {
          nSpy = npcY + ((h - mapConfig.height) / 2)
        } else {
          nSpy = npcY - msy
        }

        const sheet = IMAGES[npc.b]
        if (sheet && sheet.complete) {
          // npc.y = 哪個角色的起始 y（每個角色佔 192px）；npc.x = walk frame x（0=靜止）
          const npcBaseY = npc.y ?? 0
          const dirOffset = npc.d === 1 ? 48 : npc.d === 2 ? 96 : npc.d === 3 ? 144 : 0
          const npcSy = npcBaseY + dirOffset

          charsToRender.push({
            y: npcY + nH,
            draw: () => {
              playerCtx.drawImage(
                sheet,
                npc.x ?? 0, // walk frame x（0 = 靜止第一格）
                npcSy,
                nW,
                nH,
                nSpx,
                nSpy,
                nW,
                nH
              )
            }
          })
        }
      })
    }

    // 3. Y-Sort and Draw
    charsToRender.sort((a, b) => a.y - b.y)
    charsToRender.forEach((char) => char.draw())

    // Render foreground overlay layer from offscreen cache
    if (fgOffscreenCanvasRef.current) {
      const sWidth = Math.min(w, mapConfig.width)
      const sHeight = Math.min(h, mapConfig.height)
      const dx = w > mapConfig.width ? (w - mapConfig.width) / 2 : 0
      const dy = h > mapConfig.height ? (h - mapConfig.height) / 2 : 0

      fgCtx.drawImage(
        fgOffscreenCanvasRef.current,
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

  // 偵測行動裝置（主要輸入為觸控），並隨裝置狀態變化更新
  useEffect(() => {
    const mq = window.matchMedia('(pointer: coarse)')
    setIsTouchDevice(mq.matches)
    const onChange = (e: MediaQueryListEvent) => setIsTouchDevice(e.matches)
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
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
    const targetSpawn = mapsJson[targetMapId].map.in[spawnIndex]
    playerRef.current.px = targetSpawn.x
    playerRef.current.py = targetSpawn.y

    prepareMapCanvases(targetMapId)
    mapIdRef.current = targetMapId
    drawGame()
    // Brief timeout to let player view the fade screen
    setTimeout(() => {
      isTransSenceRef.current = false
      setTransSence(false)
    }, 500)
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
    const mapJson = mapsJson[id]

    // 推進對話（messages 以輕量 markup 字串存於地圖 JSON，渲染時轉 ReactNode）
    const advanceChat = (eventIndex: number): boolean => {
      const npcJson = mapJson.messages?.[eventIndex]
      if (!npcJson || !npcJson.text) return false

      const nextCount = useRpgStore.getState().messageCount + 1
      if (nextCount <= npcJson.text.length) {
        setNpcChat({
          isChat: true,
          npcName: npcJson.name,
          npcMessage: renderMessage(npcJson.text[nextCount - 1]),
          messageCount: nextCount,
        })
      } else {
        closeChat()
      }
      return true
    }

    // 面向處的事件碰撞區（some 短路）
    const hitEvent = mapJson.isMove.find(
      (json) =>
        json.e !== undefined &&
        json.e >= 0 &&
        aabbIntersect(p.px + x, p.py + y, nX, nY, json)
    )

    let npcFound = hitEvent ? advanceChat(hitEvent.e!) : false

    // Also check interaction against NPCs in mapJson.npc（碰撞框=下半身，見 npcFeetBox）
    if (!npcFound && mapJson.npc) {
      const hitNpc = mapJson.npc.find(
        (npc) =>
          mapJson.messages?.[npc.e] &&
          aabbIntersect(p.px + x, p.py + y, nX, nY, npcFeetBox(npc))
      )
      if (hitNpc) {
        npcFound = advanceChat(hitNpc.e)
      }
    }

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

    if (isPausedRef.current) {
      const playerCanvas = playerCanvasRef.current
      if (playerCanvas) {
        const playerCtx = playerCanvas.getContext('2d')
        if (playerCtx) {
          playerCtx.fillStyle = 'rgba(15, 23, 42, 0.6)'
          playerCtx.fillRect(0, 0, playerCanvas.width, playerCanvas.height)
          
          playerCtx.fillStyle = '#f59e0b'
          playerCtx.font = 'bold 28px sans-serif'
          playerCtx.textAlign = 'center'
          playerCtx.textBaseline = 'middle'
          playerCtx.fillText('遊戲暫停中', playerCanvas.width / 2, playerCanvas.height / 2)
          
          playerCtx.font = '14px sans-serif'
          playerCtx.fillStyle = '#cbd5e1'
          playerCtx.fillText('點擊「繼續遊戲」或按 P 鍵恢復', playerCanvas.width / 2, playerCanvas.height / 2 + 40)
        }
      }
      requestRef.current = requestAnimationFrame(loop)
      return
    }

    const p = playerRef.current
    const id = mapIdRef.current
    const mapConfig = mapsJson[id].map
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

      const mapJson = mapsJson[id]

      const canMove = (chkX: number, chkY: number) => {
        if (chkX < 0 || chkX + nX > mapConfig.width || chkY < 0 || chkY + nY > mapConfig.height) {
          return false
        }
        // some() 短路：碰到第一個阻擋即返回
        const blocked = mapJson.isMove.some((json) =>
          aabbIntersect(chkX, chkY, nX, nY, json)
        )
        if (blocked) return false

        // Also check collision against NPCs in mapJson.npc
        if (mapJson.npc) {
          return !mapJson.npc.some(
            (npc) =>
              mapJson.messages?.[npc.e] &&
              aabbIntersect(chkX, chkY, nX, nY, npcFeetBox(npc))
          )
        }
        return true
      }

      const checkTransition = (chkX: number, chkY: number) => {
        const portal = mapJson.isMove.find(
          (json) =>
            json.cm !== undefined &&
            json.cm >= 0 &&
            json.cmm !== undefined &&
            json.cmm >= 0 &&
            aabbIntersect(chkX, chkY, nX, nY, json)
        )
        if (portal) {
          triggerSceneTransition(portal.cm!, portal.cmm!)
          return true
        }
        return false
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

    if (e.keyCode === 80) { // P Key
      e.preventDefault()
      setIsPaused((prev) => {
        const val = !prev
        isPausedRef.current = val
        return val
      })
      return
    }

    if (isPausedRef.current) return

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
    const spawn = mapsJson[0].map.in[0]
    playerRef.current.px = spawn.x
    playerRef.current.py = spawn.y
    playerRef.current.left = false
    playerRef.current.right = false
    playerRef.current.up = false
    playerRef.current.down = false
    playerRef.current.sx = 0
    playerRef.current.sy = 0

    // Load assets
    preloadCoreAssets().then(() => {
      prepareMapCanvases(0)
      setImagesLoaded(true)
      isTransSenceRef.current = false
      setTransSence(false)
      drawGame()
    })

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

  // 保留供未來重新開始按鈕使用
  const _restartGame = () => {
    setIsPaused(false)
    isPausedRef.current = false
    resetRpg()
    mapIdRef.current = 0
    isTransSenceRef.current = true
    setMap(0, true)
    setTransSence(true)
    const spawn = mapsJson[0].map.in[0]
    playerRef.current.px = spawn.x
    playerRef.current.py = spawn.y
    playerRef.current.left = false
    playerRef.current.right = false
    playerRef.current.up = false
    playerRef.current.down = false
    playerRef.current.sx = 0
    playerRef.current.sy = 0

    prepareMapCanvases(0)
    setImagesLoaded(true)
    isTransSenceRef.current = false
    setTransSence(false)
    drawGame()
  }
  void _restartGame // 暫未掛上 UI，保留引用以通過 noUnusedLocals

  // 方向鍵長按事件（滑鼠 + 觸控通用；touchcancel/mouseleave 釋放避免方向卡住）
  const dirHoldProps = (dir: 'up' | 'down' | 'left' | 'right') => ({
    onMouseDown: () => { playerRef.current[dir] = true },
    onMouseUp: () => { playerRef.current[dir] = false },
    onMouseLeave: () => { playerRef.current[dir] = false },
    onTouchStart: (e: React.TouchEvent) => { e.preventDefault(); playerRef.current[dir] = true },
    onTouchEnd: (e: React.TouchEvent) => { e.preventDefault(); playerRef.current[dir] = false },
    onTouchCancel: () => { playerRef.current[dir] = false },
    onContextMenu: (e: React.MouseEvent) => { e.preventDefault() },
  })

  // ── 手遊式拖曳虛擬搖桿：按住畫面任意處拖曳即朝該方向移動 ──
  const JOY_RADIUS = 48 // 搖桿最大半徑（px）
  const JOY_DEAD = 12   // 死區，避免輕微抖動誤觸發
  const joyRef = useRef({ active: false, id: -1, ox: 0, oy: 0 })
  const joyBaseRef = useRef<HTMLDivElement>(null)
  const joyKnobRef = useRef<HTMLDivElement>(null)

  const releaseJoystick = () => {
    const p = playerRef.current
    p.left = false
    p.right = false
    p.up = false
    p.down = false
    joyRef.current.active = false
    joyBaseRef.current?.classList.add('hidden')
    joyKnobRef.current?.classList.add('hidden')
  }

  const handleJoyStart = (e: React.TouchEvent) => {
    if (!isTouchDevice || joyRef.current.active) return
    // 點到按鈕或對話框時不啟動搖桿
    if ((e.target as HTMLElement).closest('button, .rpg-chat-box')) return
    const container = canvasContainerRef.current
    if (!container) return
    const t = e.changedTouches[0]
    const rect = container.getBoundingClientRect()
    const ox = t.clientX - rect.left
    const oy = t.clientY - rect.top
    joyRef.current = { active: true, id: t.identifier, ox, oy }
    if (joyBaseRef.current && joyKnobRef.current) {
      joyBaseRef.current.style.left = `${ox}px`
      joyBaseRef.current.style.top = `${oy}px`
      joyKnobRef.current.style.left = `${ox}px`
      joyKnobRef.current.style.top = `${oy}px`
      joyBaseRef.current.classList.remove('hidden')
      joyKnobRef.current.classList.remove('hidden')
    }
  }

  const handleJoyMove = (e: React.TouchEvent) => {
    const j = joyRef.current
    if (!j.active) return
    const t = Array.from(e.changedTouches).find((t) => t.identifier === j.id)
    const container = canvasContainerRef.current
    if (!t || !container) return
    const rect = container.getBoundingClientRect()
    let dx = t.clientX - rect.left - j.ox
    let dy = t.clientY - rect.top - j.oy
    const dist = Math.hypot(dx, dy)
    if (dist > JOY_RADIUS) {
      dx = (dx / dist) * JOY_RADIUS
      dy = (dy / dist) * JOY_RADIUS
    }
    if (joyKnobRef.current) {
      joyKnobRef.current.style.left = `${j.ox + dx}px`
      joyKnobRef.current.style.top = `${j.oy + dy}px`
    }
    const p = playerRef.current
    p.left = dx < -JOY_DEAD
    p.right = dx > JOY_DEAD
    p.up = dy < -JOY_DEAD
    p.down = dy > JOY_DEAD
  }

  const handleJoyEnd = (e: React.TouchEvent) => {
    const j = joyRef.current
    if (!j.active) return
    if (!Array.from(e.changedTouches).some((t) => t.identifier === j.id)) return
    releaseJoystick()
  }

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

      {/* Game Menu Actions */}
      <div className="flex flex-wrap items-center gap-2 mb-4 justify-between select-none">
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => setShowInstructions(true)}
            className="h-8 text-xs border-slate-700 text-slate-300 bg-slate-900/80 hover:bg-slate-800 hover:text-white cursor-pointer rounded-xl flex items-center gap-1"
          >
            <HelpCircle className="size-3.5" aria-hidden="true" />
            遊戲說明
          </Button>
        </div>
      </div>

      {/* Arcade cabinet wrapper */}
      <div className="rpg-cabinet">
        {/* Game console screen */}
        <div
          ref={canvasContainerRef}
          className={`${
            isFullscreen
              ? "fixed inset-0 w-screen h-screen bg-black flex items-center justify-center z-50 border-0 rounded-none select-none"
              : "rpg-screen"
          }${isTouchDevice ? ' touch-none' : ''}`}
          onTouchStart={handleJoyStart}
          onTouchMove={handleJoyMove}
          onTouchEnd={handleJoyEnd}
          onTouchCancel={handleJoyEnd}
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
                <span>{isTouchDevice ? '點 A 鈕繼續' : '按 SPACE / 點 A 繼續'}</span>
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
                  {isTouchDevice ? (
                    <>
                      <div className="flex justify-between items-center bg-slate-950/50 p-2.5 rounded-lg border border-slate-800/50">
                        <span className="font-semibold text-slate-300">移動角色</span>
                        <span className="text-right text-xs bg-slate-800 px-2 py-1 rounded shadow-sm text-purple-400 font-mono">
                          按住畫面拖曳（虛擬搖桿）
                        </span>
                      </div>
                      <div className="flex justify-between items-center bg-slate-950/50 p-2.5 rounded-lg border border-slate-800/50">
                        <span className="font-semibold text-slate-300">對話/互動</span>
                        <span className="text-right text-xs bg-slate-800 px-2 py-1 rounded shadow-sm text-purple-400 font-mono">
                          畫面右下 A 按鈕
                        </span>
                      </div>
                      <div className="flex justify-between items-center bg-slate-950/50 p-2.5 rounded-lg border border-slate-800/50">
                        <span className="font-semibold text-slate-300">開啟本選單</span>
                        <span className="text-right text-xs bg-slate-800 px-2 py-1 rounded shadow-sm text-purple-400 font-mono">
                          畫面右上 ? 按鈕
                        </span>
                      </div>
                    </>
                  ) : (
                    <>
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
                    </>
                  )}
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
          <div className="absolute top-4 left-4 z-30 flex flex-col gap-1.5 px-3 py-1.5 rounded-xl border border-slate-700 bg-slate-900/80 text-slate-300 font-mono text-xs select-none backdrop-blur-sm">
            <div className="flex items-center gap-1.5">
              <Info className="size-3.5 text-purple-400" />
              <span>地圖: {mapsJson[mapId]?.map?.name || '加載中'}</span>
            </div>
            <div className="text-[10px] text-slate-400 border-t border-slate-800/60 pt-1">
              座標: <span ref={coordsRef}>X: 0, Y: 0</span>
            </div>
          </div>

          {/* 行動裝置螢幕內觸控操作（全螢幕時也可操作） */}
          {isTouchDevice && imagesLoaded && (
            <>
              {/* 拖曳虛擬搖桿視覺指示（按住畫面時顯示於觸碰點） */}
              <div ref={joyBaseRef} className="rpg-joy-base hidden" />
              <div ref={joyKnobRef} className="rpg-joy-knob hidden" />

              {/* 互動 A 按鈕（對話中上移避免遮擋對話框） */}
              <button
                type="button"
                className={`rpg-touch-action ${isChat ? 'bottom-40' : 'bottom-5'} right-4`}
                onTouchStart={(e) => { e.preventDefault(); handleInteract() }}
                onClick={handleInteract}
                aria-label="對話互動"
              >
                A
              </button>
            </>
          )}
        </div>

        {/* Controllers Panel（行動裝置改用螢幕內觸控操作，不顯示此面板） */}
        {!isTouchDevice && (
          <div className="flex flex-col sm:flex-row items-center justify-between gap-6 mt-6 p-4 rounded-2xl bg-slate-950 border border-slate-800 shadow-inner">

            {/* Mouse D-pad control block */}
            <div className="flex items-center gap-4">
              <div className="grid grid-cols-3 gap-1.5 size-36 shrink-0 select-none">
                <div />
                <Button
                  variant="outline"
                  size="icon"
                  className="size-11 rounded-xl border-purple-500/50 dark:border-purple-400/50 text-slate-100 dark:text-slate-100 hover:text-white bg-slate-900/90 hover:bg-purple-600/30 cursor-pointer shadow-md shadow-purple-500/10 active:scale-95 transition-all"
                  {...dirHoldProps('up')}
                  aria-label="向上移動"
                >
                  <ArrowUp className="size-5" />
                </Button>
                <div />
                <Button
                  variant="outline"
                  size="icon"
                  className="size-11 rounded-xl border-purple-500/50 dark:border-purple-400/50 text-slate-100 dark:text-slate-100 hover:text-white bg-slate-900/90 hover:bg-purple-600/30 cursor-pointer shadow-md shadow-purple-500/10 active:scale-95 transition-all"
                  {...dirHoldProps('left')}
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
                  {...dirHoldProps('right')}
                  aria-label="向右移動"
                >
                  <ArrowRight className="size-5" />
                </Button>
                <div />
                <Button
                  variant="outline"
                  size="icon"
                  className="size-11 rounded-xl border-purple-500/50 dark:border-purple-400/50 text-slate-100 dark:text-slate-100 hover:text-white bg-slate-900/90 hover:bg-purple-600/30 cursor-pointer shadow-md shadow-purple-500/10 active:scale-95 transition-all"
                  {...dirHoldProps('down')}
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
        )}
      </div>
    </div>
  )
}

export default RpgRoom
