/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useEffect, useRef, useState, useCallback } from 'react'
import { clsx } from 'clsx'
import {
  AlertTriangle,
  Camera,
  ChevronDown,
  Copy,
  Download,
  FileJson,
  FolderOpen,
  HelpCircle,
  Info,
  Keyboard,
  Layers,
  Lightbulb,
  Maximize2,
  Minimize2,
  Minus,
  Plus,
  Save,
  Settings,
  Trash2,
  Upload,
  User,
} from 'lucide-react'
import { Button, IconButton, Tag } from '@/components/toybox'
import { GameDialog, GamePageHead, KeyRow, TipBar } from '@/pages/RpgRoom/lib/gameUi'
import '@/pages/MapDeveloper/MapDeveloper.css'
import { useMapEditorStore } from '@/store/useMapEditorStore'
import type { MapTile, MapCollision } from '@/store/useMapEditorStore'
import type { MapNpc } from '@/pages/RpgRoom/types'
import { mapsJson } from '@/pages/RpgRoom/data'

// Import assets using absolute paths / Vite resolving
import bgImg from '@/assets/images/map-editor/bg.webp'
import manImg from '@/assets/images/map-editor/man.webp'
import tile1Img from '@/assets/images/map-editor/rpg_maker_xp.webp'
import tile2Img from '@/assets/images/map-editor/rpg_maker_xp2.webp'

const IMAGES = [manImg, tile1Img, tile2Img]

// 模組層級單例快取：spritesheet 與草地底圖只載入一次，重繪不再 new Image()
const sheetCache: (HTMLImageElement | null)[] = [null, null, null]
let bgTileCache: HTMLImageElement | null = null
let sheetsPromise: Promise<void> | null = null

const loadSheets = (): Promise<void> => {
  if (!sheetsPromise) {
    const loadImage = (src: string): Promise<HTMLImageElement> =>
      new Promise((resolve) => {
        const img = new Image()
        img.onload = () => resolve(img)
        img.onerror = () => resolve(img)
        img.src = src
      })
    sheetsPromise = Promise.all([...IMAGES.map(loadImage), loadImage(bgImg)]).then((imgs) => {
      sheetCache[0] = imgs[0]
      sheetCache[1] = imgs[1]
      sheetCache[2] = imgs[2]
      bgTileCache = imgs[3]
    })
  }
  return sheetsPromise
}

// 預設 NPC 樣板（站立、面向下、對話事件 0）
const createDefaultNpc = (): MapNpc => ({
  b: 0, type: 0, pX: 64, pY: 64,
  aX: 32, aY: 32, aW: 160, aH: 160,
  mX: 0, mY: 0, x: 0, y: 0, w: 32, h: 48,
  d: 0, l: 1, r: 2, u: 3, t: 0, s: 0, f: 0,
  footSpeed: 8,
  isR: false, isU: false, isD: false, isL: false, isM: false,
  e: 0,
})

export function MapDeveloper() {
  const store = useMapEditorStore()
  
  const [showJsonPanel, setShowJsonPanel] = useState(false)
  const [showHelpModal, setShowHelpModal] = useState(false)
  const [jsonInput, setJsonInput] = useState('')
  const [copied, setCopied] = useState(false)
  const [activeTab, setActiveTab] = useState<'tile' | 'collision' | 'npc'>('tile')
  const [isFocused, setIsFocused] = useState(false)
  const [isFullscreen, setIsFullscreen] = useState(false)

  // Refs
  const containerRef = useRef<HTMLDivElement>(null)
  const workspaceRef = useRef<HTMLDivElement>(null)
  const backCanvasRef = useRef<HTMLCanvasElement>(null)
  const frontCanvasRef = useRef<HTMLCanvasElement>(null)
  const collisionCanvasRef = useRef<HTMLCanvasElement>(null)
  const selectCanvasRef = useRef<HTMLCanvasElement>(null)
  const gridCanvasRef = useRef<HTMLCanvasElement>(null)
  
  const spriteCanvasRef = useRef<HTMLCanvasElement>(null)
  const spriteImgRef = useRef<HTMLImageElement>(null)
  const spriteContainerRef = useRef<HTMLDivElement>(null)

  // Tracking temporary states for drawing
  const isDrawingCollision = useRef(false)
  const collisionStartCoords = useRef({ x: 0, y: 0 })

  // 圖庫反查捲動：切換圖庫後須等 img onLoad 重設 canvas 尺寸才能捲動
  const pendingScrollToRef = useRef<{ x: number; y: number } | null>(null)

  // 拖拉 / 平移 / 雙指縮放暫存
  const dragRef = useRef<null | {
    kind: 1 | 2 | 3
    index: number
    grabDX: number
    grabDY: number
    origPX?: number
    origPY?: number
    origAX?: number
    origAY?: number
  }>(null)
  const panRef = useRef<null | {
    startX: number
    startY: number
    origLeft: number
    origTop: number
    moved: boolean
  }>(null)
  const pointersRef = useRef<Map<number, { x: number; y: number }>>(new Map())
  const pinchDistRef = useRef(0)
  const PAN_THRESHOLD = 5

  // 將 client 座標換算為地圖座標（getBoundingClientRect 已含 translate + scale）
  const toMapCoords = useCallback((clientX: number, clientY: number) => {
    const canvas = selectCanvasRef.current
    if (!canvas) return { x: 0, y: 0 }
    const rect = canvas.getBoundingClientRect()
    return {
      x: (clientX - rect.left) * (canvas.width / rect.width),
      y: (clientY - rect.top) * (canvas.height / rect.height)
    }
  }, [])

  // 捲動圖庫面板使指定來源座標置中（依 CSS 縮放比例換算）
  const scrollPaletteTo = useCallback((srcY: number) => {
    const img = spriteImgRef.current
    const cont = spriteContainerRef.current
    if (!img || !cont || !img.naturalHeight) return
    const rect = img.getBoundingClientRect()
    const dispScale = rect.height / img.naturalHeight
    cont.scrollTop = Math.max(0, srcY * dispScale - cont.clientHeight / 2)
  }, [])



  // 3. Render Sprite Selection overlay
  const drawSpriteSelection = useCallback(() => {
    const canvas = spriteCanvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    ctx.clearRect(0, 0, canvas.width, canvas.height)
    if (store.sourceX !== false && store.sourceY !== false) {
      ctx.beginPath()
      ctx.rect(store.sourceX, store.sourceY, store.sourceW, store.sourceH)
      ctx.fillStyle = 'rgba(168, 85, 247, 0.4)' // purple translucent overlay
      ctx.fill()
      ctx.lineWidth = 1.5
      ctx.strokeStyle = '#a855f7' // purple border
      ctx.stroke()
    }
    // 地圖選取物件的圖庫來源反查高亮（橘色虛線，與紫色選取區分）
    if (store.highlightX !== false && store.highlightY !== false) {
      ctx.beginPath()
      ctx.rect(store.highlightX, store.highlightY, store.highlightW, store.highlightH)
      ctx.setLineDash([5, 3])
      ctx.lineWidth = 2
      ctx.strokeStyle = '#f59e0b'
      ctx.stroke()
      ctx.setLineDash([])
    }
  }, [store.sourceX, store.sourceY, store.sourceW, store.sourceH, store.highlightX, store.highlightY, store.highlightW, store.highlightH])

  useEffect(() => {
    drawSpriteSelection()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [store.sourceX, store.sourceY, store.sourceW, store.sourceH, store.sprites, store.highlightX, store.highlightY, store.highlightW, store.highlightH])

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(document.fullscreenElement === containerRef.current)
    }
    document.addEventListener('fullscreenchange', handleFullscreenChange)
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange)
  }, [])

  // 滾輪縮放：React onWheel 為 passive 無法 preventDefault，須用原生監聽
  useEffect(() => {
    const el = workspaceRef.current
    if (!el) return
    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      const rect = el.getBoundingClientRect()
      const factor = e.deltaY < 0 ? 1.1 : 1 / 1.1
      useMapEditorStore.getState().zoomAt(factor, e.clientX - rect.left, e.clientY - rect.top)
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [])

  // 以工作區中心為錨縮放（鍵盤 / 按鈕用）
  const zoomAtCenter = useCallback((factor: number) => {
    const el = workspaceRef.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    useMapEditorStore.getState().zoomAt(factor, rect.width / 2, rect.height / 2)
  }, [])

  const toggleFullscreen = () => {
    const el = containerRef.current
    if (!el) return
    if (!document.fullscreenElement) {
      el.requestFullscreen().catch((err) => console.error('Error enabling fullscreen:', err))
    } else {
      document.exitFullscreen()
    }
  }

  // Auto-resize palette canvas when active sheet loads
  const handleSpriteImgLoad = () => {
    const img = spriteImgRef.current
    const canvas = spriteCanvasRef.current
    if (img && canvas) {
      canvas.width = img.naturalWidth || 256
      canvas.height = img.naturalHeight || 8000
      drawSpriteSelection()
      // 圖庫切換完成後執行反查捲動
      if (pendingScrollToRef.current) {
        scrollPaletteTo(pendingScrollToRef.current.y)
        pendingScrollToRef.current = null
      }
    }
  }

  // 圖庫未切換（onLoad 不會觸發）時的反查捲動；切換中（img 尚未載入完成）則交給 onLoad
  useEffect(() => {
    if (store.highlightY !== false && pendingScrollToRef.current && spriteImgRef.current?.complete) {
      scrollPaletteTo(pendingScrollToRef.current.y)
      pendingScrollToRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [store.highlightX, store.highlightY, store.sprites])

  // Draw layers onto canvases
  const drawAllLayers = () => {
    drawBackgroundLayer()
    drawForegroundLayer()
    drawCollisionLayer()
    drawSelectOutline()
    drawGridLines()
  }

  const drawBackgroundLayer = () => {
    const canvas = backCanvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    ctx.clearRect(0, 0, store.width, store.height)
    ctx.globalAlpha = store.opacityB

    // Draw grid grass repeating tiles (使用模組層級快取)
    if (bgTileCache && bgTileCache.complete) {
      const tileW = 32
      const tileH = 32
      const cols = Math.ceil(store.width / tileW)
      const rows = Math.ceil(store.height / tileH)
      for (let c = 0; c < cols; c++) {
        for (let r = 0; r < rows; r++) {
          ctx.drawImage(bgTileCache, 0, 0, 32, 32, c * tileW, r * tileH, tileW, tileH)
        }
      }
    }

    // Draw background objects (z !== 2)
    store.styles.forEach((tile) => {
      if (tile.z === 2) return
      drawTile(ctx, tile)
    })
    ctx.globalAlpha = 1
  }

  // 共用 tile 繪製：使用快取 spritesheet，支援 rx/ry 重複展開
  const drawTile = (ctx: CanvasRenderingContext2D, tile: MapTile) => {
    const sheet = sheetCache[tile.b]
    if (!sheet || !sheet.complete) return
    const rx = tile.rx ?? 1
    const ry = tile.ry ?? 1
    for (let ix = 0; ix < rx; ix++) {
      for (let iy = 0; iy < ry; iy++) {
        ctx.drawImage(
          sheet,
          tile.x, tile.y, tile.w, tile.h,
          tile.l + ix * tile.w, tile.t + iy * tile.h, tile.w, tile.h
        )
      }
    }
  }

  const drawForegroundLayer = () => {
    const canvas = frontCanvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    ctx.clearRect(0, 0, store.width, store.height)
    ctx.globalAlpha = store.opacityF

    // Draw foreground objects (z === 2)
    store.styles.forEach((tile) => {
      if (tile.z !== 2) return
      drawTile(ctx, tile)
    })
    ctx.globalAlpha = 1
  }

  const drawCollisionLayer = () => {
    const canvas = collisionCanvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    ctx.clearRect(0, 0, store.width, store.height)
    ctx.globalAlpha = store.opacityM

    // Draw collisions
    store.isMoveArr.forEach((c) => {
      ctx.beginPath()
      ctx.rect(c.x, c.y, c.w, c.h)
      ctx.fillStyle = 'rgba(14, 165, 233, 0.5)' // semi-transparent cyan
      ctx.fill()
      ctx.lineWidth = 1
      ctx.strokeStyle = '#0ea5e9'
      ctx.stroke()
    })

    // Draw NPC markers (位置 + 活動範圍)
    store.npcArr.forEach((npc, index) => {
      // 活動範圍（虛線橘框）
      ctx.beginPath()
      ctx.rect(npc.aX, npc.aY, npc.aW, npc.aH)
      ctx.setLineDash([6, 4])
      ctx.lineWidth = 1
      ctx.strokeStyle = '#f59e0b'
      ctx.stroke()
      ctx.setLineDash([])

      // NPC 實際圖片（與 RpgRoom 遊戲端渲染一致：y + 朝向偏移）
      const sheet = sheetCache[npc.b]
      if (sheet && sheet.complete) {
        const dirOffset = npc.d === 1 ? 48 : npc.d === 2 ? 96 : npc.d === 3 ? 144 : 0
        const nW = npc.w || 32
        const nH = npc.h || 48
        ctx.drawImage(sheet, npc.x ?? 0, (npc.y ?? 0) + dirOffset, nW, nH, npc.pX, npc.pY, nW, nH)
      }

      // NPC 本體（綠框）
      ctx.beginPath()
      ctx.rect(npc.pX, npc.pY, npc.w, npc.h)
      ctx.fillStyle = 'rgba(34, 197, 94, 0.35)'
      ctx.fill()
      ctx.lineWidth = 1.5
      ctx.strokeStyle = '#22c55e'
      ctx.stroke()
      ctx.fillStyle = '#22c55e'
      ctx.font = 'bold 10px monospace'
      ctx.fillText(`NPC ${index}`, npc.pX, npc.pY - 4)
    })

    // Draw spawn points (出生點紫色菱形標記)
    store.inArr.forEach((point, index) => {
      ctx.beginPath()
      ctx.rect(point.x, point.y, 32, 48)
      ctx.lineWidth = 1.5
      ctx.strokeStyle = '#a855f7'
      ctx.setLineDash([3, 3])
      ctx.stroke()
      ctx.setLineDash([])
      ctx.fillStyle = '#a855f7'
      ctx.font = 'bold 10px monospace'
      ctx.fillText(`in[${index}]`, point.x, point.y - 4)
    })
    ctx.globalAlpha = 1
  }

  const drawSelectOutline = () => {
    const canvas = selectCanvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    ctx.clearRect(0, 0, store.width, store.height)

    // Highlight selected item
    if (store.mapObjects === 1) {
      const tile = store.styles[store.objectNum]
      if (tile) {
        ctx.beginPath()
        ctx.rect(tile.l, tile.t, tile.w, tile.h)
        ctx.lineWidth = 2
        ctx.strokeStyle = '#f59e0b' // yellow border for tile
        ctx.setLineDash([4, 4])
        ctx.stroke()
        ctx.setLineDash([])
      }
    } else if (store.mapObjects === 2) {
      const col = store.isMoveArr[store.objectNum]
      if (col) {
        ctx.beginPath()
        ctx.rect(col.x, col.y, col.w, col.h)
        ctx.lineWidth = 2
        ctx.strokeStyle = '#ef4444' // red border for collision
        ctx.setLineDash([4, 4])
        ctx.stroke()
        ctx.setLineDash([])
      }
    } else if (store.mapObjects === 3) {
      const npc = store.npcArr[store.objectNum]
      if (npc) {
        ctx.beginPath()
        ctx.rect(npc.pX - 2, npc.pY - 2, (npc.w || 32) + 4, (npc.h || 48) + 4)
        ctx.lineWidth = 2
        ctx.strokeStyle = '#22c55e' // green border for npc
        ctx.setLineDash([4, 4])
        ctx.stroke()
        ctx.setLineDash([])
      }
    }
  }

  const drawGridLines = () => {
    const canvas = gridCanvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    ctx.clearRect(0, 0, store.width, store.height)
    ctx.strokeStyle = 'rgba(148, 163, 184, 0.15)' // slate border grid
    ctx.lineWidth = 0.5

    const tileW = 32
    const tileH = 32

    // Draw vertical lines
    if (store.gridX) {
      ctx.fillStyle = 'rgba(148, 163, 184, 0.4)'
      ctx.font = '9px monospace'
      ctx.textAlign = 'center'
      for (let x = tileW; x < store.width; x += tileW) {
        ctx.beginPath()
        ctx.moveTo(x, 0)
        ctx.lineTo(x, store.height)
        ctx.stroke()
        // Label x
        ctx.fillText(x.toString(), x, 12)
      }
    }

    // Draw horizontal lines
    if (store.gridY) {
      ctx.fillStyle = 'rgba(148, 163, 184, 0.4)'
      ctx.font = '9px monospace'
      ctx.textAlign = 'left'
      for (let y = tileH; y < store.height; y += tileH) {
        ctx.beginPath()
        ctx.moveTo(0, y)
        ctx.lineTo(store.width, y)
        ctx.stroke()
        // Label y
        ctx.fillText(y.toString(), 4, y - 2)
      }
    }
  }

  // 1. Initial configuration and load
  useEffect(() => {
    store.loadFromLocalStorage()
    // 載入快取的 spritesheet 後再繪製
    loadSheets().then(() => {
      drawAllLayers()
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // 2. Refresh workspace drawing on state updates
  useEffect(() => {
    drawAllLayers()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    store.width,
    store.height,
    store.styles,
    store.isMoveArr,
    store.npcArr,
    store.inArr,
    store.opacityB,
    store.opacityF,
    store.opacityM,
    store.gridX,
    store.gridY,
    store.mapObjects,
    store.objectNum
  ])

  // Handle Palette Sprite Click
  const handleSpriteMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = spriteCanvasRef.current
    if (!canvas) return
    const rect = canvas.getBoundingClientRect()
    // 將 CSS 顯示座標換算回 canvas 自然像素（man.png 128px / tile 256px 在容器內會被 CSS 縮放）
    const scaleX = canvas.width / rect.width
    const scaleY = canvas.height / rect.height
    const clickX = (e.clientX - rect.left) * scaleX
    const clickY = (e.clientY - rect.top) * scaleY

    // Grid coordinates
    const gridX = 32 * Math.floor(clickX / 32)
    const gridY = 32 * Math.floor(clickY / 32)

    if (e.button === 0) {
      // Left click: set start or range selection
      if (store.sourceX === false || store.sourceY === false) {
        store.setSpriteSelection(gridX, gridY, 32, 32)
      } else {
        const srcX = store.sourceX
        const srcY = store.sourceY
        let w: number
        let h: number
        let x = srcX
        let y = srcY

        if (gridX >= srcX) {
          w = gridX - srcX + 32
        } else {
          x = gridX
          w = srcX - gridX + 32
        }

        if (gridY >= srcY) {
          h = gridY - srcY + 32
        } else {
          y = gridY
          h = srcY - gridY + 32
        }

        store.setSpriteSelection(x, y, w, h)
      }
    } else {
      // Right click: reset selection
      store.setSpriteSelection(false, false, 32, 32)
    }
  }

  // Handle Workspace Map Pointer Down（滑鼠 + 觸控）
  const handleMapPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = selectCanvasRef.current
    if (!canvas) return

    // 追蹤多指：第二指落下進入雙指縮放，取消拖拉/平移
    pointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
    if (pointersRef.current.size === 2) {
      dragRef.current = null
      panRef.current = null
      isDrawingCollision.current = false
      const pts = [...pointersRef.current.values()]
      pinchDistRef.current = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y)
      return
    }
    if (pointersRef.current.size > 2) return

    try {
      canvas.setPointerCapture(e.pointerId)
    } catch {
      // 部分環境（合成事件）不支援 pointer capture，忽略即可
    }
    const { x: clickX, y: clickY } = toMapCoords(e.clientX, e.clientY)

    // Aligned to 32px
    const gridX = 32 * Math.floor(clickX / 32)
    const gridY = 32 * Math.floor(clickY / 32)

    if (store.sourceX !== false && store.sourceY !== false) {
      // We have active tile selection: DRAW on grid!
      const isForeground = e.button === 2 // Right click draws foreground
      store.addTile({
        n: store.objectName || 'Unamed Tile',
        l: gridX,
        t: gridY,
        w: store.sourceW,
        h: store.sourceH,
        b: store.sprites,
        x: store.sourceX,
        y: store.sourceY,
        z: isForeground ? 2 : undefined
      })
    } else {
      // No active tile selected: select / drag / pan or start collision box
      const isAltPressed = e.altKey

      if (isAltPressed) {
        // Start drawing collision box
        if (e.button === 0) {
          isDrawingCollision.current = true
          collisionStartCoords.current = { x: clickX, y: clickY }

          // Selection context
          const ctx = canvas.getContext('2d')
          if (ctx) {
            ctx.clearRect(0, 0, store.width, store.height)
          }
        }
      } else {
        // Selection detection
        let clickedIdx = -1

        if (e.button === 0) {
          // NPC 命中優先（NPC 較小且常疊在貼圖上）
          store.npcArr.forEach((npc, index) => {
            const nW = npc.w || 32
            const nH = npc.h || 48
            if (
              clickX >= npc.pX && clickX <= npc.pX + nW &&
              clickY >= npc.pY && clickY <= npc.pY + nH
            ) {
              clickedIdx = index
            }
          })
          if (clickedIdx !== -1) {
            const npc = store.npcArr[clickedIdx]
            store.selectElement(3, clickedIdx)
            setActiveTab('npc')
            dragRef.current = {
              kind: 3,
              index: clickedIdx,
              grabDX: clickX - npc.pX,
              grabDY: clickY - npc.pY,
              origPX: npc.pX,
              origPY: npc.pY,
              origAX: npc.aX,
              origAY: npc.aY
            }
            return
          }

          // Left click selects styles
          store.styles.forEach((tile, index) => {
            if (
              clickX >= tile.l && clickX <= tile.l + tile.w &&
              clickY >= tile.t && clickY <= tile.t + tile.h
            ) {
              clickedIdx = index
            }
          })
          if (clickedIdx !== -1) {
            const tile = store.styles[clickedIdx]
            store.selectElement(1, clickedIdx)
            setActiveTab('tile')
            // 圖庫反查：切換到對應圖庫並捲動高亮來源位置（不寫 sourceX，維持選取模式）
            pendingScrollToRef.current = { x: tile.x, y: tile.y }
            store.selectSpriteSheet(tile.b)
            store.setPaletteHighlight(tile.x, tile.y, tile.w, tile.h)
            dragRef.current = {
              kind: 1,
              index: clickedIdx,
              grabDX: clickX - tile.l,
              grabDY: clickY - tile.t
            }
            return
          }

          // 點中已選取的碰撞區域可直接左鍵/觸控拖拉
          if (store.mapObjects === 2) {
            const col = store.isMoveArr[store.objectNum]
            if (
              col &&
              clickX >= col.x && clickX <= col.x + col.w &&
              clickY >= col.y && clickY <= col.y + col.h
            ) {
              dragRef.current = {
                kind: 2,
                index: store.objectNum,
                grabDX: clickX - col.x,
                grabDY: clickY - col.y
              }
              return
            }
          }

          // 空白區：準備平移（pointerup 時若未移動才取消選取）
          panRef.current = {
            startX: e.clientX,
            startY: e.clientY,
            origLeft: store.mapLeft,
            origTop: store.mapTop,
            moved: false
          }
        } else if (e.button === 2) {
          // Right click selects collisions
          e.preventDefault()
          store.isMoveArr.forEach((col, index) => {
            if (
              clickX >= col.x && clickX <= col.x + col.w &&
              clickY >= col.y && clickY <= col.y + col.h
            ) {
              clickedIdx = index
            }
          })
          if (clickedIdx !== -1) {
            const col = store.isMoveArr[clickedIdx]
            store.selectElement(2, clickedIdx)
            setActiveTab('collision')
            // 右鍵也可直接拖拉碰撞區域
            dragRef.current = {
              kind: 2,
              index: clickedIdx,
              grabDX: clickX - col.x,
              grabDY: clickY - col.y
            }
          } else {
            store.selectElement(null, 0)
          }
        }
      }
    }
  }

  // Handle Drag / Pan / Pinch / Draw Collision
  const handleMapPointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    // 雙指縮放
    if (pointersRef.current.size === 2 && pointersRef.current.has(e.pointerId)) {
      pointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
      const pts = [...pointersRef.current.values()]
      const dist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y)
      if (pinchDistRef.current > 0 && dist > 0) {
        const workspace = workspaceRef.current
        if (workspace) {
          const rect = workspace.getBoundingClientRect()
          const midX = (pts[0].x + pts[1].x) / 2 - rect.left
          const midY = (pts[0].y + pts[1].y) / 2 - rect.top
          store.zoomAt(dist / pinchDistRef.current, midX, midY)
        }
      }
      pinchDistRef.current = dist
      return
    }

    // 拖拉選取物件
    if (dragRef.current) {
      const { x: clickX, y: clickY } = toMapCoords(e.clientX, e.clientY)
      const drag = dragRef.current
      if (drag.kind === 1) {
        // 貼圖：對齊 32px 格線
        const l = 32 * Math.round((clickX - drag.grabDX) / 32)
        const t = 32 * Math.round((clickY - drag.grabDY) / 32)
        store.updateElementProps(1, drag.index, { l, t })
      } else if (drag.kind === 2) {
        // 碰撞區域：自由移動
        store.updateElementProps(2, drag.index, {
          x: Math.round(clickX - drag.grabDX),
          y: Math.round(clickY - drag.grabDY)
        })
      } else {
        // NPC：本體與活動範圍同步位移（以原始值計算避免漂移）
        const nx = Math.round(clickX - drag.grabDX)
        const ny = Math.round(clickY - drag.grabDY)
        store.updateNpcProps(drag.index, {
          pX: nx,
          pY: ny,
          aX: (drag.origAX ?? 0) + (nx - (drag.origPX ?? 0)),
          aY: (drag.origAY ?? 0) + (ny - (drag.origPY ?? 0))
        })
      }
      return
    }

    // 空白區平移
    if (panRef.current) {
      const pan = panRef.current
      const dx = e.clientX - pan.startX
      const dy = e.clientY - pan.startY
      if (!pan.moved && Math.hypot(dx, dy) > PAN_THRESHOLD) pan.moved = true
      if (pan.moved) {
        store.setMapOffset(pan.origLeft + dx, pan.origTop + dy)
      }
      return
    }

    // 繪製碰撞框預覽
    if (!isDrawingCollision.current) return
    const canvas = selectCanvasRef.current
    if (!canvas) return
    const { x: clickX, y: clickY } = toMapCoords(e.clientX, e.clientY)

    const startX = collisionStartCoords.current.x
    const startY = collisionStartCoords.current.y

    const drawX = Math.min(startX, clickX)
    const drawY = Math.min(startY, clickY)
    const drawW = Math.abs(clickX - startX)
    const drawH = Math.abs(clickY - startY)

    // Render transparent guide block
    const ctx = canvas.getContext('2d')
    if (ctx) {
      drawSelectOutline() // keep standard select outline
      ctx.beginPath()
      ctx.rect(drawX, drawY, drawW, drawH)
      ctx.fillStyle = 'rgba(14, 165, 233, 0.4)'
      ctx.fill()
      ctx.strokeStyle = '#0ea5e9'
      ctx.lineWidth = 1.5
      ctx.stroke()
    }
  }

  const handleMapPointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    pointersRef.current.delete(e.pointerId)
    if (pointersRef.current.size < 2) pinchDistRef.current = 0

    const canvas = selectCanvasRef.current
    if (canvas?.hasPointerCapture(e.pointerId)) {
      canvas.releasePointerCapture(e.pointerId)
    }

    // 結束拖拉
    if (dragRef.current) {
      dragRef.current = null
      return
    }

    // 結束平移；原地點擊空白區 → 取消選取
    if (panRef.current) {
      if (!panRef.current.moved) {
        store.selectElement(null, 0)
      }
      panRef.current = null
      return
    }

    if (!isDrawingCollision.current) return
    isDrawingCollision.current = false
    if (!canvas) return
    const { x: clickX, y: clickY } = toMapCoords(e.clientX, e.clientY)

    const startX = collisionStartCoords.current.x
    const startY = collisionStartCoords.current.y

    const finalX = Math.min(startX, clickX)
    const finalY = Math.min(startY, clickY)
    const finalW = Math.abs(clickX - startX)
    const finalH = Math.abs(clickY - startY)

    if (finalW > 4 && finalH > 4) {
      store.addCollision({
        n: store.objectName || 'Collision Area',
        x: Math.round(finalX),
        y: Math.round(finalY),
        w: Math.round(finalW),
        h: Math.round(finalH)
      })
      setActiveTab('collision')
    }
    drawSelectOutline()
  }

  // Keyboard navigation / Shortcuts
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (showJsonPanel || !isFocused) return

    // Avoid running inputs override hotkeys
    const targetTag = (e.target as HTMLElement).tagName
    if (targetTag === 'INPUT' || targetTag === 'TEXTAREA' || targetTag === 'SELECT') {
      return
    }

    const panSpeed = 32
    switch (e.key.toLowerCase()) {
      case 'g':
        store.toggleGrid('X')
        store.toggleGrid('Y')
        break
      case 'f':
        store.setOpacity('F', store.opacityF === 0 ? 1 : 0)
        break
      case 'b':
        store.setOpacity('B', store.opacityB === 0 ? 1 : 0)
        break
      case 'm':
        store.setOpacity('M', store.opacityM === 0 ? 1 : 0)
        break
      case 'a':
      case 'arrowleft':
        e.preventDefault()
        store.panMap(panSpeed, 0)
        break
      case 'd':
      case 'arrowright':
        e.preventDefault()
        store.panMap(-panSpeed, 0)
        break
      case 'w':
      case 'arrowup':
        e.preventDefault()
        store.panMap(0, panSpeed)
        break
      case 's':
        if (e.altKey) {
          e.preventDefault()
          store.saveToLocalStorage()
          alert('地圖已成功儲存至本地快取！')
        } else {
          e.preventDefault()
          store.panMap(0, -panSpeed)
        }
        break
      case 'arrowdown':
        e.preventDefault()
        store.panMap(0, -panSpeed)
        break
      case '+':
      case '=':
        e.preventDefault()
        zoomAtCenter(1.1)
        break
      case '-':
      case '_':
        e.preventDefault()
        zoomAtCenter(1 / 1.1)
        break
      case '0':
        e.preventDefault()
        store.resetView()
        break
      case 'delete':
        if (store.mapObjects !== null) {
          store.deleteElement(store.mapObjects, store.objectNum)
        }
        break
      case 'c':
        if (e.altKey) {
          e.preventDefault()
          if (confirm('確定要清除所有地圖貼圖與碰撞區域嗎？')) {
            store.clearMap()
          }
        }
        break
      case 'l':
        if (e.altKey) {
          e.preventDefault()
          store.loadFromLocalStorage()
        }
        break
    }
  }, [store, showJsonPanel, isFocused, zoomAtCenter])

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [handleKeyDown])

  // Load Map JSON Input
  const handleLoadJson = () => {
    try {
      const parsed = JSON.parse(jsonInput)
      const success = store.loadMapJson(parsed)
      if (success) {
        alert('地圖載入成功！')
        setShowJsonPanel(false)
      } else {
        alert('載入失敗：格式不正確。')
      }
    } catch {
      alert('JSON 格式解析錯誤！')
    }
  }

  // 載入現有地圖（RpgRoom data/000N_map.json，深拷貝避免編輯時汙染模組資料）
  const handleLoadExistingMap = (idx: number) => {
    const data = mapsJson[idx]
    if (!data) return
    const hasContent = store.styles.length > 0 || store.isMoveArr.length > 0 || store.npcArr.length > 0
    if (hasContent && !confirm(`確定要載入「${data.map.name}」嗎？目前未儲存的編輯內容將被覆蓋。`)) return
    const cloned = structuredClone(data)
    store.loadMapJson({
      ...cloned,
      // data 檔的 n 為選填，store 需必填字串
      styles: cloned.styles.map((s) => ({ n: '', ...s })),
      isMove: cloned.isMove.map((c) => ({ n: '', ...c })),
    })
    store.resetView()
  }

  // Copy map data（完整 schema：含 map.index/name/in 與 messages，匯出即可直接使用）
  const handleCopyJson = () => {
    navigator.clipboard.writeText(JSON.stringify(store.exportMapJson(), null, '\t'))
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  // Export current layers as canvas screenshots
  const exportCanvas = (type: 'F' | 'B') => {
    const canvas = type === 'F' ? frontCanvasRef.current : backCanvasRef.current
    if (!canvas) return
    const link = document.createElement('a')
    link.download = `map_${type === 'F' ? 'front' : 'back'}_${Date.now()}.png`
    link.href = canvas.toDataURL()
    link.click()
  }

  // Palette scroll wheel support
  const handlePaletteWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    const scrollAmount = e.deltaY > 0 ? 64 : -64
    if (spriteContainerRef.current) {
      spriteContainerRef.current.scrollTop += scrollAmount
    }
  }

  // Inspector Form edits
  const handleTileEdit = (field: keyof MapTile, value: any) => {
    if (store.mapObjects === 1) {
      store.updateElementProps(1, store.objectNum, { [field]: value })
    }
  }

  const handleCollisionEdit = (field: keyof MapCollision, value: any) => {
    if (store.mapObjects === 2) {
      store.updateElementProps(2, store.objectNum, { [field]: value })
    }
  }

  // Compile JSON map string（僅面板開啟時計算，避免每次 render 序列化大型地圖）
  const currentMapJson = showJsonPanel
    ? JSON.stringify(store.exportMapJson(), null, '\t')
    : ''

  const activeElement = store.mapObjects === 1
    ? store.styles[store.objectNum]
    : store.mapObjects === 2
      ? store.isMoveArr[store.objectNum]
      : null

  const activeNpc = store.mapObjects === 3 ? store.npcArr[store.objectNum] : null

  const handleNpcEdit = (field: keyof MapNpc, value: number) => {
    if (store.mapObjects === 3) {
      store.updateNpcProps(store.objectNum, { [field]: value })
    }
  }

  const numField = (label: string, value: number | string, onChange?: (v: string) => void, extra?: { readOnly?: boolean; placeholder?: string; type?: string }) => (
    <label className="mapdev-field">
      <span className="mapdev-label">{label}</span>
      <input
        type={extra?.type ?? 'number'}
        value={value}
        readOnly={extra?.readOnly}
        placeholder={extra?.placeholder}
        onChange={onChange ? (e) => onChange(e.target.value) : undefined}
        className={clsx('tb-input', extra?.readOnly && 'mapdev-readonly')}
      />
    </label>
  )

  return (
    <div ref={containerRef} className="tb-container mapdev-page" data-testid="page-map-developer">

      {/* 頁首 */}
      <GamePageHead eyebrow="— MAP EDITOR —" title="2D 地圖與場景開發器" intro="React 19 等寬網格圖層場景編輯工具" />

      {/* 全域工具列 */}
      <div className="mapdev-toolbar">
        <MapSelect
          className="w-auto min-w-56"
          value=""
          onChange={(e) => {
            if (e.target.value === '') return
            handleLoadExistingMap(Number(e.target.value))
          }}
          aria-label="載入現有地圖"
        >
          <option value="" disabled>載入現有地圖...</option>
          {mapsJson.map((m, i) => (
            <option key={i} value={i}>
              {m.map.index}. {m.map.name} ({m.map.width}×{m.map.height})
            </option>
          ))}
        </MapSelect>
        <Button size="s" icon={<HelpCircle strokeWidth={2.5} aria-hidden="true" />} onClick={() => setShowHelpModal(true)} aria-label="快速鍵說明">
          快速鍵說明
        </Button>
        <Button size="s" icon={<FileJson strokeWidth={2.5} aria-hidden="true" />} onClick={() => setShowJsonPanel(!showJsonPanel)} aria-label="導入 / 導出 JSON" aria-pressed={showJsonPanel}>
          導入 / 導出 JSON
        </Button>
        <Button size="s" icon={<FolderOpen strokeWidth={2.5} aria-hidden="true" />} onClick={() => store.loadFromLocalStorage()} aria-label="讀取暫存">
          讀取暫存 (Alt+L)
        </Button>
        <Button
          size="s"
          icon={isFullscreen ? <Minimize2 strokeWidth={2.5} aria-hidden="true" /> : <Maximize2 strokeWidth={2.5} aria-hidden="true" />}
          onClick={toggleFullscreen}
          aria-label="切換全螢幕"
        >
          {isFullscreen ? '離開全螢幕' : '全螢幕開發'}
        </Button>
        <Button
          size="s"
          variant="primary"
          icon={<Save strokeWidth={2.5} aria-hidden="true" />}
          onClick={() => {
            store.saveToLocalStorage()
            alert('地圖已成功儲存至本地快取！')
          }}
          aria-label="儲存地圖"
        >
          儲存地圖 (Alt+S)
        </Button>
      </div>

      {/* JSON 面板 */}
      {showJsonPanel && (
        <div className="mapdev-box">
          <h3 className="mapdev-h4 text-heading-m">
            <FileJson strokeWidth={2.5} aria-hidden="true" /> 地圖 JSON 代碼工具
          </h3>
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            <div className="mapdev-field">
              <div className="flex items-center justify-between gap-3">
                <span className="mapdev-label">當前地圖代碼 (匯出)</span>
                <Button size="s" icon={<Copy strokeWidth={2.5} aria-hidden="true" />} onClick={handleCopyJson} aria-label="複製 JSON">
                  {copied ? '已複製' : '複製 JSON'}
                </Button>
              </div>
              <textarea
                className="tb-textarea h-44 text-body-s"
                readOnly
                value={currentMapJson}
                aria-label="當前地圖 JSON 代碼匯出"
              />
            </div>
            <div className="mapdev-field">
              <div className="flex items-center justify-between gap-3">
                <span className="mapdev-label">載入地圖 JSON (匯入)</span>
                <Button size="s" icon={<Upload strokeWidth={2.5} aria-hidden="true" />} onClick={handleLoadJson} aria-label="解析並載入">
                  解析並載入
                </Button>
              </div>
              <textarea
                className="tb-textarea h-44 text-body-s"
                placeholder="在此貼上舊地圖匯出的 JSON 代碼..."
                value={jsonInput}
                onChange={(e) => setJsonInput(e.target.value)}
                aria-label="貼上要匯入的地圖 JSON 代碼"
              />
            </div>
          </div>
        </div>
      )}

      {/* 三欄工作區 */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">

        {/* 左：圖庫 */}
        <div className="mapdev-panel lg:col-span-3">
          <div className="mapdev-panel__head">
            <span className="flex items-center gap-2 whitespace-nowrap">
              <Layers strokeWidth={2.5} aria-hidden="true" />
              圖庫拼圖區
            </span>
            <MapSelect
              className="w-full"
              value={store.sprites}
              onChange={(e) => store.selectSpriteSheet(Number(e.target.value))}
              aria-label="選擇圖庫"
            >
              <option value={0}>NPC (角色)</option>
              <option value={1}>拼圖一 (Tileset 1)</option>
              <option value={2}>拼圖二 (Tileset 2)</option>
            </MapSelect>
          </div>

          <div ref={spriteContainerRef} onWheel={handlePaletteWheel} className="mapdev-palette">
            <div className="mapdev-palette__frame">
              <canvas
                ref={spriteCanvasRef}
                onMouseDown={handleSpriteMouseDown}
                onContextMenu={(e) => e.preventDefault()}
                className="absolute top-0 left-0 z-10 h-auto w-full cursor-crosshair"
              />
              <img
                ref={spriteImgRef}
                src={IMAGES[store.sprites]}
                onLoad={handleSpriteImgLoad}
                className="pointer-events-none block h-auto w-full select-none"
                alt="tiles"
              />
            </div>
          </div>

          <div className="p-3">
            <TipBar icon={<Lightbulb strokeWidth={2.5} aria-hidden="true" />} className="py-2 text-caption">
              <p className="font-bold">選取提示：</p>
              <p>• 點選第一個格點，再點選第二個格點可框選多格子貼圖。</p>
              <p>• 按滑鼠右鍵可取消圖庫選擇，進入地圖物件編輯模式。</p>
            </TipBar>
          </div>
        </div>

        {/* 中：畫布 */}
        <div className="mapdev-canvas-col lg:col-span-6">

          {/* 畫布工具列：縮放、圖層透明度、鍵盤狀態 */}
          <div className="mapdev-canvas-tools">
            <div className="flex items-center gap-2">
              <IconButton icon={<Minus strokeWidth={2.5} />} label="縮小" onClick={() => zoomAtCenter(1 / 1.1)} />
              <button
                type="button"
                onClick={() => store.resetView()}
                className="tb-focus h-11 w-14 cursor-pointer rounded-toy-sm text-center font-pixel text-pixel-m text-ink"
                aria-label="重設縮放"
                title="點擊重設縮放 (0)"
              >
                {Math.round(store.scale * 100)}%
              </button>
              <IconButton icon={<Plus strokeWidth={2.5} />} label="放大" onClick={() => zoomAtCenter(1.1)} />
            </div>
            {([
              ['B', '背景層', store.opacityB],
              ['F', '前景層', store.opacityF],
              ['M', '碰撞層', store.opacityM],
            ] as const).map(([layer, name, value]) => (
              <label key={layer} className="flex items-center gap-2">
                <span>{name}:</span>
                <input
                  type="range" min="0" max="1" step="0.1"
                  className="mapdev-range"
                  value={value}
                  onChange={(e) => store.setOpacity(layer, Number(e.target.value))}
                />
              </label>
            ))}
            <Tag tone={isFocused ? 'mint' : 'sky'}>
              {isFocused ? '● 鍵盤控制已啟用' : '點擊畫布以啟用鍵盤'}
            </Tag>
          </div>

          {/* 畫布外框（ScreenFrame 結構；畫面區要掛 ref 處理滾輪與焦點，故直接寫 tb-screen） */}
          <div className="tb-screen mapdev-screen">
            <div className="tb-screen__bar">
              <span className="tb-screen__title">MAP EDITOR</span>
              <span className="tb-screen__meta">{store.width}×{store.height}</span>
            </div>
            <div
              ref={workspaceRef}
              tabIndex={0}
              onFocus={() => setIsFocused(true)}
              onBlur={() => setIsFocused(false)}
              className="tb-screen__view mapdev-screen__view"
            >
              {/* Translate + Scale map wrapper */}
              <div
                className="relative border border-on-inverse-muted"
                style={{
                  width: store.width,
                  height: store.height,
                  transform: `translate3d(${store.mapLeft}px, ${store.mapTop}px, 0) scale(${store.scale})`,
                  transformOrigin: '0 0'
                }}
              >
                {/* Layer 1: Background Canvas */}
                <canvas
                  ref={backCanvasRef}
                  width={store.width}
                  height={store.height}
                  className="absolute top-0 left-0 z-0 pointer-events-none"
                />

                {/* Layer 2: Foreground Canvas */}
                <canvas
                  ref={frontCanvasRef}
                  width={store.width}
                  height={store.height}
                  className="absolute top-0 left-0 z-10 pointer-events-none"
                />

                {/* Layer 3: Collision Blocks */}
                <canvas
                  ref={collisionCanvasRef}
                  width={store.width}
                  height={store.height}
                  className="absolute top-0 left-0 z-20 pointer-events-none"
                />

                {/* Layer 4: Selection Outline & Input Capture */}
                <canvas
                  ref={selectCanvasRef}
                  width={store.width}
                  height={store.height}
                  onPointerDown={handleMapPointerDown}
                  onPointerMove={handleMapPointerMove}
                  onPointerUp={handleMapPointerUp}
                  onPointerCancel={handleMapPointerUp}
                  onContextMenu={(e) => e.preventDefault()}
                  className="absolute top-0 left-0 z-30 cursor-cell touch-none"
                />

                {/* Layer 5: Grid Labels */}
                <canvas
                  ref={gridCanvasRef}
                  width={store.width}
                  height={store.height}
                  className="absolute top-0 left-0 z-40 pointer-events-none"
                />
              </div>
            </div>

            {/* 狀態列 */}
            <div className="mapdev-status">
              <div className="flex flex-wrap gap-x-4">
                <span><span className="mapdev-status__key">畫布寬度:</span> <strong className="mapdev-status__val">{store.width}px</strong></span>
                <span><span className="mapdev-status__key">畫布高度:</span> <strong className="mapdev-status__val">{store.height}px</strong></span>
                <span><span className="mapdev-status__key">平移偏移:</span> <strong className="mapdev-status__val">X: {Math.round(store.mapLeft)} | Y: {Math.round(store.mapTop)}</strong></span>
                <span><span className="mapdev-status__key">縮放:</span> <strong className="mapdev-status__val">{Math.round(store.scale * 100)}%</strong></span>
              </div>
              <div className="flex flex-wrap gap-x-4">
                <span><span className="mapdev-status__key">放置名稱:</span> <strong className="mapdev-status__val">{store.objectName || 'Unamed'}</strong></span>
                <span><span className="mapdev-status__key">選定元素種類:</span> <strong className="mapdev-status__val font-body text-caption">{store.mapObjects === 1 ? '地圖貼圖' : store.mapObjects === 2 ? '碰撞區域' : store.mapObjects === 3 ? 'NPC' : '無'}</strong></span>
              </div>
            </div>
          </div>
        </div>

        {/* 右：屬性視察器 */}
        <div className="mapdev-panel lg:col-span-3">
          <div className="mapdev-panel__head">
            <span className="flex items-center gap-2">
              <Settings strokeWidth={2.5} aria-hidden="true" />
              屬性視察器
            </span>
          </div>

          {/* 屬性分頁（直排 SegmentedControl 外觀） */}
          <div className="p-3">
            <div className="tb-seg mapdev-tabs" role="group" aria-label="屬性分頁">
              {([
                ['tile', `地圖貼圖 (${store.styles.length})`],
                ['collision', `碰撞區域 (${store.isMoveArr.length})`],
                ['npc', `NPC (${store.npcArr.length})`],
              ] as const).map(([tab, text]) => (
                <button
                  key={tab}
                  type="button"
                  aria-pressed={activeTab === tab}
                  onClick={() => setActiveTab(tab)}
                  className="tb-seg__opt mapdev-tab"
                >
                  {text}
                </button>
              ))}
            </div>
          </div>

          <div className="mapdev-panel__body">

            {/* 地圖全域設定 */}
            <div className="mapdev-section">
              <h4 className="mapdev-h4"><Settings strokeWidth={2.5} aria-hidden="true" />地圖全域設定</h4>
              <div className="mapdev-grid2">
                {numField('地圖索引 (Index)', store.mapIndex, (v) => store.setMapMeta(Number(v) || 0, store.mapName))}
                {numField('地圖名稱 (Name)', store.mapName, (v) => store.setMapMeta(store.mapIndex, v), { type: 'text' })}
              </div>
              <div className="mapdev-grid2">
                {numField('地圖寬度 (Width)', store.width, (v) => store.setMapSize(Number(v) || 0, store.height))}
                {numField('地圖高度 (Height)', store.height, (v) => store.setMapSize(store.width, Number(v) || 0))}
              </div>
              {numField('預設放置名稱', store.objectName, (v) => store.setObjectName(v), { type: 'text', placeholder: '新物件名稱' })}

              <div className="flex flex-col gap-3">
                <Button size="s" variant={store.gridX ? 'pop' : 'secondary'} aria-pressed={store.gridX} onClick={() => store.toggleGrid('X')} className="w-full">
                  X 格線標示: {store.gridX ? '開' : '關'}
                </Button>
                <Button size="s" variant={store.gridY ? 'pop' : 'secondary'} aria-pressed={store.gridY} onClick={() => store.toggleGrid('Y')} className="w-full">
                  Y 格線標示: {store.gridY ? '開' : '關'}
                </Button>
              </div>

              {/* Spawn points (in[]) editor */}
              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="mapdev-label">出生點 in[]（索引對應其他地圖的 cmm）</span>
                  <Button size="s" icon={<Plus strokeWidth={2.5} aria-hidden="true" />} onClick={() => store.addSpawnPoint({ x: 32, y: 32 })}>
                    新增
                  </Button>
                </div>
                {store.inArr.length === 0 && (
                  <p className="mapdev-help">尚無出生點，遊戲將無法傳送進入此地圖。</p>
                )}
                {store.inArr.map((point, index) => (
                  <div key={index} className="flex items-center gap-2">
                    <span className="w-8 shrink-0 font-pixel text-pixel-m text-ink-muted">[{index}]</span>
                    <input
                      type="number"
                      value={point.x}
                      onChange={(e) => store.updateSpawnPoint(index, { x: Number(e.target.value) || 0 })}
                      className="tb-input px-2"
                      aria-label={`出生點 ${index} X`}
                    />
                    <input
                      type="number"
                      value={point.y}
                      onChange={(e) => store.updateSpawnPoint(index, { y: Number(e.target.value) || 0 })}
                      className="tb-input px-2"
                      aria-label={`出生點 ${index} Y`}
                    />
                    <IconButton
                      icon={<Trash2 strokeWidth={2.5} aria-hidden="true" />}
                      label={`刪除出生點 ${index}`}
                      onClick={() => store.deleteSpawnPoint(index)}
                    />
                  </div>
                ))}
              </div>
            </div>

            {/* NPC Editing Panel */}
            {activeTab === 'npc' ? (
              <div className="flex flex-col gap-3">
                <div className="flex items-center justify-between gap-2">
                  <h4 className="mapdev-h4"><User strokeWidth={2.5} aria-hidden="true" />NPC 編輯</h4>
                  <Button size="s" icon={<Plus strokeWidth={2.5} aria-hidden="true" />} onClick={() => store.addNpc(createDefaultNpc())}>
                    新增 NPC
                  </Button>
                </div>

                {store.npcArr.length === 0 ? (
                  <p className="mapdev-help">尚無 NPC。點「新增 NPC」後在下方表單調整位置與事件。</p>
                ) : (
                  <div className="flex flex-col gap-2">
                    {store.npcArr.map((npc, index) => (
                      <button
                        key={index}
                        type="button"
                        onClick={() => store.selectElement(3, index)}
                        aria-pressed={store.mapObjects === 3 && store.objectNum === index}
                        className="mapdev-item"
                      >
                        NPC {index}｜({npc.pX}, {npc.pY})｜{npc.type === 4 ? '行走' : '站立'}｜事件 e={npc.e}
                      </button>
                    ))}
                  </div>
                )}

                {activeNpc && (
                  <div className="flex flex-col gap-3 border-t-3 border-line pt-4">
                    <div className="mapdev-grid2">
                      {numField('位置 X (pX)', activeNpc.pX, (v) => handleNpcEdit('pX', Number(v)))}
                      {numField('位置 Y (pY)', activeNpc.pY, (v) => handleNpcEdit('pY', Number(v)))}
                    </div>

                    <div className="mapdev-grid2">
                      <label className="mapdev-field">
                        <span className="mapdev-label">類型</span>
                        <MapSelect value={activeNpc.type} onChange={(e) => handleNpcEdit('type', Number(e.target.value))}>
                          <option value={0}>站立</option>
                          <option value={4}>行走</option>
                        </MapSelect>
                      </label>
                      <label className="mapdev-field">
                        <span className="mapdev-label">朝向 (d)</span>
                        <MapSelect value={activeNpc.d} onChange={(e) => handleNpcEdit('d', Number(e.target.value))}>
                          <option value={0}>下</option>
                          <option value={1}>左</option>
                          <option value={2}>右</option>
                          <option value={3}>上</option>
                        </MapSelect>
                      </label>
                    </div>

                    <label className="mapdev-field">
                      <span className="mapdev-label">角色外觀 (y，man.png 每隻佔 192px)</span>
                      <MapSelect value={activeNpc.y} onChange={(e) => handleNpcEdit('y', Number(e.target.value))}>
                        {Array.from({ length: 7 }, (_, i) => (
                          <option key={i} value={i * 192}>角色 {i + 1} (y={i * 192})</option>
                        ))}
                      </MapSelect>
                    </label>

                    {numField('對話事件索引 (e，對應 messages[e])', activeNpc.e, (v) => handleNpcEdit('e', Number(v)))}

                    <div className="mapdev-field">
                      <span className="mapdev-label">活動範圍 (aX / aY / aW / aH，行走型用)</span>
                      <div className="grid grid-cols-2 gap-2">
                        {(['aX', 'aY', 'aW', 'aH'] as const).map((field) => (
                          <input
                            key={field}
                            type="number"
                            value={activeNpc[field]}
                            onChange={(e) => handleNpcEdit(field, Number(e.target.value))}
                            className="tb-input px-2"
                            aria-label={field}
                          />
                        ))}
                      </div>
                      {activeNpc.type === 4 && (
                        <div className="flex flex-col gap-2">
                          <TipBar icon={<AlertTriangle strokeWidth={2.5} aria-hidden="true" />} className="bg-pop py-2 text-caption">
                            行走型會在活動範圍（紫框）內隨機走動：範圍須完整包住 NPC（32×48）且不可與碰撞區重疊，否則 NPC 會卡住。
                          </TipBar>
                          <Button
                            size="s"
                            className="w-full whitespace-normal"
                            onClick={() => {
                              // 以目前位置為中心套用 5×4 格活動範圍
                              store.updateNpcProps(store.objectNum, {
                                aX: activeNpc.pX - 64,
                                aY: activeNpc.pY - 48,
                                aW: 160,
                                aH: 144,
                              })
                            }}
                          >
                            以目前位置套用預設範圍 (160×144)
                          </Button>
                        </div>
                      )}
                    </div>

                    {numField('步行速度 (footSpeed，8 = 每幀 1px)', activeNpc.footSpeed, (v) => handleNpcEdit('footSpeed', Number(v)))}

                    <Button
                      className="w-full"
                      icon={<Trash2 strokeWidth={2.5} aria-hidden="true" />}
                      onClick={() => store.deleteElement(3, store.objectNum)}
                      aria-label="刪除此 NPC"
                    >
                      刪除此 NPC
                    </Button>
                  </div>
                )}
              </div>
            ) : activeElement ? (
              <div className="flex flex-col gap-3">
                <div className="flex items-center justify-between gap-2">
                  <h4 className="mapdev-h4">
                    <Info strokeWidth={2.5} aria-hidden="true" />
                    {store.mapObjects === 1 ? '貼圖物件' : '碰撞區域'} 屬性編輯
                  </h4>
                  <span className="font-pixel text-pixel-m text-ink-muted">ID: {store.objectNum}</span>
                </div>

                {store.mapObjects === 1 ? (
                  // MapTile (styles) Edit Panel
                  <>
                    {numField('物件名稱', (activeElement as MapTile).n || '', (v) => handleTileEdit('n', v), { type: 'text' })}
                    <div className="mapdev-grid2">
                      {numField('畫布 X 座標', (activeElement as MapTile).l, (v) => handleTileEdit('l', Number(v)))}
                      {numField('畫布 Y 座標', (activeElement as MapTile).t, (v) => handleTileEdit('t', Number(v)))}
                    </div>
                    <div className="mapdev-grid2">
                      {numField('物件寬度', (activeElement as MapTile).w, (v) => handleTileEdit('w', Number(v)))}
                      {numField('物件高度', (activeElement as MapTile).h, (v) => handleTileEdit('h', Number(v)))}
                    </div>
                    <div className="mapdev-grid2">
                      {numField('圖庫 X 座標', (activeElement as MapTile).x, undefined, { readOnly: true })}
                      {numField('圖庫 Y 座標', (activeElement as MapTile).y, undefined, { readOnly: true })}
                    </div>
                    <div className="mapdev-grid2">
                      {numField(
                        '使用的圖庫',
                        (activeElement as MapTile).b === 0 ? 'NPC' : (activeElement as MapTile).b === 1 ? '拼圖一' : '拼圖二',
                        undefined,
                        { readOnly: true, type: 'text' },
                      )}
                      <label className="mapdev-field">
                        <span className="mapdev-label">前後層屬性</span>
                        <MapSelect
                          value={(activeElement as MapTile).z === 2 ? '2' : '0'}
                          onChange={(e) => handleTileEdit('z', e.target.value === '2' ? 2 : undefined)}
                        >
                          <option value="0">後層 (背景層)</option>
                          <option value="2">前層 (遮罩前景)</option>
                        </MapSelect>
                      </label>
                    </div>
                  </>
                ) : (
                  // MapCollision (isMove) Edit Panel
                  <>
                    {numField('區域名稱', (activeElement as MapCollision).n || '', (v) => handleCollisionEdit('n', v), { type: 'text' })}
                    <div className="mapdev-grid2">
                      {numField('X 座標', (activeElement as MapCollision).x, (v) => handleCollisionEdit('x', Number(v)))}
                      {numField('Y 座標', (activeElement as MapCollision).y, (v) => handleCollisionEdit('y', Number(v)))}
                    </div>
                    <div className="mapdev-grid2">
                      {numField('寬度', (activeElement as MapCollision).w, (v) => handleCollisionEdit('w', Number(v)))}
                      {numField('高度', (activeElement as MapCollision).h, (v) => handleCollisionEdit('h', Number(v)))}
                    </div>
                    {numField(
                      '觸發事件 ID',
                      (activeElement as MapCollision).e ?? '',
                      (v) => handleCollisionEdit('e', v !== '' ? Number(v) : undefined),
                      { placeholder: '無' },
                    )}
                    <div className="mapdev-grid2">
                      {numField(
                        '傳送地圖 ID',
                        (activeElement as MapCollision).cm ?? '',
                        (v) => handleCollisionEdit('cm', v !== '' ? Number(v) : undefined),
                        { placeholder: '無' },
                      )}
                      {numField(
                        '傳送地圖點',
                        (activeElement as MapCollision).cmm ?? '',
                        (v) => handleCollisionEdit('cmm', v !== '' ? Number(v) : undefined),
                        { placeholder: '無' },
                      )}
                    </div>
                  </>
                )}

                <Button
                  className="mt-2 w-full"
                  icon={<Trash2 strokeWidth={2.5} aria-hidden="true" />}
                  onClick={() => {
                    if (store.mapObjects !== null) {
                      store.deleteElement(store.mapObjects, store.objectNum)
                    }
                  }}
                  aria-label="刪除此物件"
                >
                  刪除此物件
                </Button>
              </div>
            ) : (
              <div className="mapdev-empty">
                <Info className="size-6" strokeWidth={2.5} aria-hidden="true" />
                <p>請點選畫布上的貼圖物件或碰撞區域進行視察</p>
              </div>
            )}

            {/* Screenshots & Quick tools */}
            <div className="flex flex-col gap-3 border-t-3 border-line pt-5">
              <h4 className="mapdev-h4"><Camera strokeWidth={2.5} aria-hidden="true" />匯出場景快照</h4>
              <Button size="s" className="w-full" icon={<Download strokeWidth={2.5} aria-hidden="true" />} onClick={() => exportCanvas('B')} aria-label="導出背景層圖片">
                導出背景層 (.png)
              </Button>
              <Button size="s" className="w-full" icon={<Download strokeWidth={2.5} aria-hidden="true" />} onClick={() => exportCanvas('F')} aria-label="導出前景層圖片">
                導出前景層 (.png)
              </Button>
            </div>

          </div>
        </div>

      </div>

      {/* 快速鍵說明對話框 */}
      {showHelpModal && (
        <GameDialog fixed title="地圖編輯器 快速鍵說明" icon={<Keyboard strokeWidth={2.5} />} primaryLabel="關閉說明" onClose={() => setShowHelpModal(false)}>
          <div className="flex flex-col">
            {([
              ['網格線切換', 'G'],
              ['前景遮罩顯示/隱藏', 'F'],
              ['背景底圖顯示/隱藏', 'B'],
              ['碰撞區域顯示/隱藏', 'M'],
              ['畫布平移控制', 'W / A / S / D 或 方向鍵 或 拖曳空白區'],
              ['畫布縮放', '滾輪 / 雙指縮放 / + − 0'],
              ['移動物件（NPC / 貼圖 / 碰撞）', '點選後直接拖曳'],
              ['刪除選取之物件', 'Delete'],
              ['快速劃分碰撞區域', 'Alt + 滑鼠左鍵拖曳'],
              ['儲存地圖至本地暫存', 'Alt + S'],
              ['自本地載入暫存紀錄', 'Alt + L'],
              ['清除地圖與碰撞區', 'Alt + C'],
            ] as const).map(([label, keys]) => (
              <KeyRow key={label} label={label} keys={keys} />
            ))}
          </div>
        </GameDialog>
      )}

    </div>
  )
}

/** tb-select＋右側 ChevronDown（pages-spec §2） */
function MapSelect({ className, children, ...rest }: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <div className={clsx('mapdev-select', className)}>
      <select className="tb-select" {...rest}>
        {children}
      </select>
      <ChevronDown className="mapdev-select__icon" strokeWidth={2.5} aria-hidden="true" />
    </div>
  )
}

export default MapDeveloper
