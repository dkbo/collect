/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useEffect, useRef, useState, useCallback } from 'react'
import { 
  Layers, 
  Settings, 
  Trash2, 
  Download, 
  Upload, 
  HelpCircle, 
  Grid, 
  Save, 
  FileJson, 
  Copy,
  Info,
  FolderOpen,
  Keyboard
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useMapEditorStore } from '@/store/useMapEditorStore'
import type { MapTile, MapCollision } from '@/store/useMapEditorStore'
import type { MapNpc } from '@/pages/RpgRoom/types'

// Import assets using absolute paths / Vite resolving
import bgImg from '@/assets/images/map-editor/bg.jpg'
import manImg from '@/assets/images/map-editor/man.png'
import tile1Img from '@/assets/images/map-editor/rpg_maker_xp.png'
import tile2Img from '@/assets/images/map-editor/rpg_maker_xp2.png'

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
  
  // Refs
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
  }, [store.sourceX, store.sourceY, store.sourceW, store.sourceH])

  useEffect(() => {
    drawSpriteSelection()
  }, [store.sourceX, store.sourceY, store.sourceW, store.sourceH, store.sprites])

  // Auto-resize palette canvas when active sheet loads
  const handleSpriteImgLoad = () => {
    const img = spriteImgRef.current
    const canvas = spriteCanvasRef.current
    if (img && canvas) {
      canvas.width = img.naturalWidth || 256
      canvas.height = img.naturalHeight || 8000
      drawSpriteSelection()
    }
  }

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
    const clickX = e.clientX - rect.left
    const clickY = e.clientY - rect.top

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

  // Handle Workspace Map Click
  const handleMapMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = selectCanvasRef.current
    if (!canvas) return
    const rect = canvas.getBoundingClientRect()
    const clickX = e.clientX - rect.left
    const clickY = e.clientY - rect.top

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
      // No active tile selected: select or start collision box
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
            store.selectElement(1, clickedIdx)
            setActiveTab('tile')
          } else {
            store.selectElement(null, 0)
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
            store.selectElement(2, clickedIdx)
            setActiveTab('collision')
          } else {
            store.selectElement(null, 0)
          }
        }
      }
    }
  }

  // Handle Drag / Draw Collision
  const handleMapMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawingCollision.current) return
    const canvas = selectCanvasRef.current
    if (!canvas) return
    const rect = canvas.getBoundingClientRect()
    const clickX = e.clientX - rect.left
    const clickY = e.clientY - rect.top

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

  const handleMapMouseUp = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawingCollision.current) return
    isDrawingCollision.current = false
    const canvas = selectCanvasRef.current
    if (!canvas) return
    const rect = canvas.getBoundingClientRect()
    const clickX = e.clientX - rect.left
    const clickY = e.clientY - rect.top

    const startX = collisionStartCoords.current.x
    const startY = collisionStartCoords.current.y

    const finalX = Math.min(startX, clickX)
    const finalY = Math.min(startY, clickY)
    const finalW = Math.abs(clickX - startX)
    const finalH = Math.abs(clickY - startY)

    if (finalW > 4 && finalH > 4) {
      store.addCollision({
        n: store.objectName || 'Collision Area',
        x: finalX,
        y: finalY,
        w: finalW,
        h: finalH
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
  }, [store, showJsonPanel, isFocused])

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

  return (
    <div className="flex flex-col min-h-screen text-slate-100 font-sans select-none pb-20 animate-fade-in" data-testid="page-map-developer">
      
      {/* Top Tools Area */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 mb-5 shadow-2xl backdrop-blur-md flex flex-wrap gap-5 justify-between items-center relative z-20">
        <div className="flex items-center gap-3">
          <div className="bg-gradient-to-tr from-purple-500 to-indigo-600 p-2.5 rounded-xl shadow-lg shadow-purple-500/20">
            <Layers className="h-5 w-5 text-white" aria-hidden="true" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-white m-0 leading-normal">
              2D 地圖與場景開發器
            </h1>
            <p className="text-xs text-slate-400 mt-0.5">
              React 19 等寬網格圖層場景編輯工具
            </p>
          </div>
        </div>

        {/* Global Controls */}
        <div className="flex flex-wrap gap-2.5">
          <Button 
            variant="outline"
            className="border-slate-800 text-slate-300 hover:text-white hover:bg-slate-800 focus-visible:ring-2 focus-visible:ring-purple-500 outline-none"
            onClick={() => setShowHelpModal(true)}
            aria-label="快速鍵說明"
          >
            <HelpCircle className="h-4 w-4 mr-2" aria-hidden="true" />
            快速鍵說明
          </Button>
          <Button 
            variant="outline"
            className="border-slate-800 text-slate-300 hover:text-white hover:bg-slate-800 focus-visible:ring-2 focus-visible:ring-purple-500 outline-none"
            onClick={() => setShowJsonPanel(!showJsonPanel)}
            aria-label="導入 / 導出 JSON"
          >
            <FileJson className="h-4 w-4 mr-2" aria-hidden="true" />
            導入 / 導出 JSON
          </Button>
          <Button 
            variant="outline"
            className="border-slate-800 text-slate-300 hover:text-white hover:bg-slate-800 focus-visible:ring-2 focus-visible:ring-purple-500 outline-none"
            onClick={() => store.loadFromLocalStorage()}
            aria-label="讀取暫存"
          >
            <FolderOpen className="h-4 w-4 mr-2" aria-hidden="true" />
            讀取暫存 (Alt+L)
          </Button>
          <Button 
            className="bg-purple-600 text-white hover:bg-purple-700 font-semibold focus-visible:ring-2 focus-visible:ring-purple-500 outline-none"
            onClick={() => {
              store.saveToLocalStorage()
              alert('地圖已成功儲存至本地快取！')
            }}
            aria-label="儲存地圖"
          >
            <Save className="h-4 w-4 mr-2" aria-hidden="true" />
            儲存地圖 (Alt+S)
          </Button>
        </div>
      </div>

      {/* JSON Collapsible Input panel */}
      {showJsonPanel && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 mb-5 shadow-2xl animate-slide-in relative z-20">
          <h3 className="text-sm font-semibold mb-3 text-purple-400 flex items-center gap-2">
            <FileJson className="h-4 w-4" aria-hidden="true" /> 地圖 JSON 代碼工具
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <div className="flex justify-between items-center mb-1.5">
                <span className="text-xs text-slate-400">當前地圖代碼 (匯出)</span>
                <Button 
                  size="sm" 
                  variant="ghost" 
                  onClick={handleCopyJson} 
                  className="h-7 text-xs text-purple-400 hover:text-purple-300 hover:bg-slate-800 focus-visible:ring-2 focus-visible:ring-purple-500 outline-none"
                  aria-label="複製 JSON"
                >
                  <Copy className="h-3 w-3 mr-1" aria-hidden="true" />
                  {copied ? '已複製' : '複製 JSON'}
                </Button>
              </div>
              <textarea 
                className="w-full h-44 rounded-xl border border-slate-800 bg-slate-950 p-3 font-mono text-xs text-emerald-400 focus:outline-none"
                readOnly
                value={currentMapJson}
                aria-label="當前地圖 JSON 代碼匯出"
              />
            </div>
            <div>
              <div className="flex justify-between items-center mb-1.5">
                <span className="text-xs text-slate-400">載入地圖 JSON (匯入)</span>
                <Button 
                  size="sm"
                  onClick={handleLoadJson}
                  className="h-7 bg-emerald-600 text-white hover:bg-emerald-700 text-xs font-semibold focus-visible:ring-2 focus-visible:ring-purple-500 outline-none"
                  aria-label="解析並載入"
                >
                  <Upload className="h-3 w-3 mr-1" aria-hidden="true" />
                  解析並載入
                </Button>
              </div>
              <textarea 
                className="w-full h-44 rounded-xl border border-slate-800 bg-slate-950 p-3 font-mono text-xs text-slate-300 focus:border-purple-500 focus:outline-none"
                placeholder="在此貼上舊地圖匯出的 JSON 代碼..."
                value={jsonInput}
                onChange={(e) => setJsonInput(e.target.value)}
                aria-label="貼上要匯入的地圖 JSON 代碼"
              />
            </div>
          </div>
        </div>
      )}

      {/* Main Workspace Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 relative z-10">
        
        {/* Left: Palette Panel (3 columns) */}
        <div className="lg:col-span-3 flex flex-col bg-slate-900/90 border border-slate-800 rounded-2xl shadow-xl overflow-hidden backdrop-blur-md">
          <div className="p-4 border-b border-slate-800 flex items-center justify-between">
            <span className="text-sm font-semibold flex items-center gap-2">
              <Layers className="h-4 w-4 text-purple-400" aria-hidden="true" />
              圖庫拼圖區
            </span>
            <select 
              className="bg-slate-950 border border-slate-800 rounded-lg text-xs px-2.5 py-1.5 outline-none focus:border-purple-500 font-sans cursor-pointer text-slate-300"
              value={store.sprites} 
              onChange={(e) => store.selectSpriteSheet(Number(e.target.value))}
            >
              <option value={0}>NPC (角色)</option>
              <option value={1}>拼圖一 (Tileset 1)</option>
              <option value={2}>拼圖二 (Tileset 2)</option>
            </select>
          </div>

          {/* Palette Viewport */}
          <div 
            ref={spriteContainerRef}
            onWheel={handlePaletteWheel}
            className="flex-1 max-h-[500px] lg:max-h-[680px] overflow-y-auto relative bg-slate-950/80 p-2.5 scrollbar-thin"
          >
            <div className="relative border border-slate-800/60 rounded-xl overflow-hidden">
              <canvas 
                ref={spriteCanvasRef}
                onMouseDown={handleSpriteMouseDown}
                onContextMenu={(e) => e.preventDefault()}
                className="absolute top-0 left-0 z-10 cursor-crosshair"
              />
              <img 
                ref={spriteImgRef}
                src={IMAGES[store.sprites]} 
                onLoad={handleSpriteImgLoad}
                className="w-full h-auto block pointer-events-none select-none"
                alt="tiles"
              />
            </div>
          </div>
          
          <div className="p-3 bg-slate-950/50 border-t border-slate-800 text-[10px] text-slate-400 space-y-1">
            <p className="font-semibold text-purple-400">💡 選取提示：</p>
            <p>• 點選第一個格點，再點選第二個格點可框選多格子貼圖。</p>
            <p>• 按滑鼠右鍵可取消圖庫選擇，進入地圖物件編輯模式。</p>
          </div>
        </div>

        {/* Center: Canvas Workspace (6 columns) */}
        <div className="lg:col-span-6 flex flex-col bg-slate-900/90 border border-slate-800 rounded-2xl shadow-xl backdrop-blur-md overflow-hidden relative min-h-[550px] lg:min-h-[720px]">
          
          {/* Workspace info & Controls */}
          <div className="p-4 border-b border-slate-800 bg-slate-950/20 flex flex-wrap gap-4 items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-sm font-semibold flex items-center gap-2">
                <Grid className="h-4 w-4 text-emerald-400" aria-hidden="true" />
                場景工作區 
              </span>
              <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold border ${
                isFocused 
                  ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400 animate-pulse' 
                  : 'bg-slate-800 border-slate-700 text-slate-400'
              }`}>
                {isFocused ? '● 鍵盤控制已啟用' : '點擊畫布以啟用鍵盤'}
              </span>
            </div>
            
            {/* Opacities control toggles */}
            <div className="flex flex-wrap items-center gap-3 text-xs">
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] text-slate-400">背景層:</span>
                <input 
                  type="range" min="0" max="1" step="0.1"
                  className="w-12 h-1 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-purple-500"
                  value={store.opacityB}
                  onChange={(e) => store.setOpacity('B', Number(e.target.value))}
                />
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] text-slate-400">前景層:</span>
                <input 
                  type="range" min="0" max="1" step="0.1"
                  className="w-12 h-1 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-purple-500"
                  value={store.opacityF}
                  onChange={(e) => store.setOpacity('F', Number(e.target.value))}
                />
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] text-slate-400">碰撞層:</span>
                <input 
                  type="range" min="0" max="1" step="0.1"
                  className="w-12 h-1 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-purple-500"
                  value={store.opacityM}
                  onChange={(e) => store.setOpacity('M', Number(e.target.value))}
                />
              </div>
            </div>
          </div>

          {/* Canvas Containment area */}
          <div 
            ref={workspaceRef}
            tabIndex={0}
            onFocus={() => setIsFocused(true)}
            onBlur={() => setIsFocused(false)}
            className="flex-1 relative overflow-auto bg-slate-950 p-5 outline-none scrollbar-thin"
          >
            {/* Translate-based map wrapper */}
            <div 
              className="relative shadow-2xl border border-slate-800 transition-transform duration-75"
              style={{
                width: store.width,
                height: store.height,
                transform: `translate3d(${store.mapLeft}px, ${store.mapTop}px, 0)`
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
                onMouseDown={handleMapMouseDown}
                onMouseMove={handleMapMouseMove}
                onMouseUp={handleMapMouseUp}
                onContextMenu={(e) => e.preventDefault()}
                className="absolute top-0 left-0 z-30 cursor-cell"
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

          {/* Map coordinate Statusbar */}
          <div className="p-3 bg-slate-950/80 border-t border-slate-800 text-[10px] text-slate-400 flex items-center justify-between">
            <div className="flex gap-4">
              <span>畫布寬度: <strong className="text-emerald-400">{store.width}px</strong></span>
              <span>畫布高度: <strong className="text-emerald-400">{store.height}px</strong></span>
              <span>平移偏移: <strong className="text-purple-400">X: {store.mapLeft} | Y: {store.mapTop}</strong></span>
            </div>
            <div className="flex gap-2.5">
              <span>放置名稱: <strong className="text-purple-400">{store.objectName || 'Unamed'}</strong></span>
              <span>選定元素種類: <strong className="text-emerald-400">{store.mapObjects === 1 ? '地圖貼圖' : store.mapObjects === 2 ? '碰撞區域' : '無'}</strong></span>
            </div>
          </div>
        </div>

        {/* Right: Inspector and Editor Panel (3 columns) */}
        <div className="lg:col-span-3 flex flex-col bg-slate-900/90 border border-slate-800 rounded-2xl shadow-xl overflow-hidden backdrop-blur-md">
          
          <div className="p-4 border-b border-slate-800 flex items-center justify-between">
            <span className="text-sm font-semibold flex items-center gap-2">
              <Settings className="h-4 w-4 text-purple-400" aria-hidden="true" />
              屬性視察器
            </span>
          </div>

          {/* Inspector Tabs */}
          <div className="flex border-b border-slate-800">
            <button 
              onClick={() => setActiveTab('tile')}
              className={`flex-1 py-2 text-xs font-semibold ${activeTab === 'tile' ? 'bg-purple-600/10 text-purple-400 border-b border-purple-500' : 'text-slate-400 hover:text-slate-200'}`}
            >
              地圖貼圖 ({store.styles.length})
            </button>
            <button
              onClick={() => setActiveTab('collision')}
              className={`flex-1 py-2 text-xs font-semibold ${activeTab === 'collision' ? 'bg-purple-600/10 text-purple-400 border-b border-purple-500' : 'text-slate-400 hover:text-slate-200'}`}
            >
              碰撞區域 ({store.isMoveArr.length})
            </button>
            <button
              onClick={() => setActiveTab('npc')}
              className={`flex-1 py-2 text-xs font-semibold ${activeTab === 'npc' ? 'bg-purple-600/10 text-purple-400 border-b border-purple-500' : 'text-slate-400 hover:text-slate-200'}`}
            >
              NPC ({store.npcArr.length})
            </button>
          </div>

          <div className="flex-1 p-4 overflow-y-auto space-y-4 text-xs">
            
            {/* Map Global Config section */}
            <div className="space-y-2 border-b border-slate-800 pb-4">
              <h4 className="font-semibold text-slate-300">⚙️ 地圖全域設定</h4>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] text-slate-400">地圖索引 (Index)</label>
                  <input
                    type="number"
                    value={store.mapIndex}
                    onChange={(e) => store.setMapMeta(Number(e.target.value) || 0, store.mapName)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-1.5 focus:border-purple-500 outline-none text-slate-200 text-xs font-mono"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-slate-400">地圖名稱 (Name)</label>
                  <input
                    type="text"
                    value={store.mapName}
                    onChange={(e) => store.setMapMeta(store.mapIndex, e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-1.5 focus:border-purple-500 outline-none text-slate-200 text-xs"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] text-slate-400">地圖寬度 (Width)</label>
                  <input 
                    type="number"
                    value={store.width}
                    onChange={(e) => store.setMapSize(Number(e.target.value) || 0, store.height)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-1.5 focus:border-purple-500 outline-none text-slate-200 text-xs font-mono"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-slate-400">地圖高度 (Height)</label>
                  <input 
                    type="number"
                    value={store.height}
                    onChange={(e) => store.setMapSize(store.width, Number(e.target.value) || 0)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-1.5 focus:border-purple-500 outline-none text-slate-200 text-xs font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="text-[10px] text-slate-400">預設放置名稱</label>
                <input 
                  type="text"
                  placeholder="新物件名稱"
                  value={store.objectName}
                  onChange={(e) => store.setObjectName(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg p-1.5 focus:border-purple-500 outline-none text-slate-200 text-xs"
                />
              </div>

              <div className="grid grid-cols-2 gap-2 pt-2">
                <Button 
                  size="sm"
                  variant="outline"
                  onClick={() => store.toggleGrid('X')}
                  className={`h-8 border-slate-800 text-[10px] ${store.gridX ? 'bg-purple-600/10 text-purple-400 border-purple-500/30' : 'text-slate-300'}`}
                >
                  X 格線標示: {store.gridX ? '開' : '關'}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => store.toggleGrid('Y')}
                  className={`h-8 border-slate-800 text-[10px] ${store.gridY ? 'bg-purple-600/10 text-purple-400 border-purple-500/30' : 'text-slate-300'}`}
                >
                  Y 格線標示: {store.gridY ? '開' : '關'}
                </Button>
              </div>

              {/* Spawn points (in[]) editor */}
              <div className="pt-2 space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-[10px] text-slate-400">出生點 in[]（索引對應其他地圖的 cmm）</label>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => store.addSpawnPoint({ x: 32, y: 32 })}
                    className="h-6 px-2 border-slate-800 text-[10px] text-purple-400 hover:text-purple-300"
                  >
                    + 新增
                  </Button>
                </div>
                {store.inArr.length === 0 && (
                  <p className="text-[10px] text-slate-500">尚無出生點，遊戲將無法傳送進入此地圖。</p>
                )}
                {store.inArr.map((point, index) => (
                  <div key={index} className="flex items-center gap-1.5">
                    <span className="text-[10px] text-purple-400 font-mono w-8 shrink-0">[{index}]</span>
                    <input
                      type="number"
                      value={point.x}
                      onChange={(e) => store.updateSpawnPoint(index, { x: Number(e.target.value) || 0 })}
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg p-1 font-mono text-[10px]"
                      aria-label={`出生點 ${index} X`}
                    />
                    <input
                      type="number"
                      value={point.y}
                      onChange={(e) => store.updateSpawnPoint(index, { y: Number(e.target.value) || 0 })}
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg p-1 font-mono text-[10px]"
                      aria-label={`出生點 ${index} Y`}
                    />
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => store.deleteSpawnPoint(index)}
                      className="h-6 w-6 p-0 text-red-400 hover:text-red-300 shrink-0"
                      aria-label={`刪除出生點 ${index}`}
                    >
                      <Trash2 className="h-3 w-3" aria-hidden="true" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>

            {/* NPC Editing Panel */}
            {activeTab === 'npc' ? (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="font-semibold text-emerald-400">🧍 NPC 編輯</h4>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => store.addNpc(createDefaultNpc())}
                    className="h-7 px-2 border-slate-800 text-[10px] text-emerald-400 hover:text-emerald-300"
                  >
                    + 新增 NPC
                  </Button>
                </div>

                {store.npcArr.length === 0 ? (
                  <p className="text-[10px] text-slate-500">尚無 NPC。點「新增 NPC」後在下方表單調整位置與事件。</p>
                ) : (
                  <div className="space-y-1">
                    {store.npcArr.map((npc, index) => (
                      <button
                        key={index}
                        onClick={() => store.selectElement(3, index)}
                        className={`w-full text-left px-2.5 py-1.5 rounded-lg border text-[10px] font-mono ${
                          store.mapObjects === 3 && store.objectNum === index
                            ? 'bg-emerald-600/10 border-emerald-500/40 text-emerald-300'
                            : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        NPC {index}｜({npc.pX}, {npc.pY})｜{npc.type === 4 ? '行走' : '站立'}｜事件 e={npc.e}
                      </button>
                    ))}
                  </div>
                )}

                {activeNpc && (
                  <div className="space-y-3 border-t border-slate-800 pt-3">
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-[10px] text-slate-400">位置 X (pX)</label>
                        <input
                          type="number"
                          value={activeNpc.pX}
                          onChange={(e) => handleNpcEdit('pX', Number(e.target.value))}
                          className="w-full bg-slate-950 border border-slate-800 rounded-lg p-1.5 font-mono"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] text-slate-400">位置 Y (pY)</label>
                        <input
                          type="number"
                          value={activeNpc.pY}
                          onChange={(e) => handleNpcEdit('pY', Number(e.target.value))}
                          className="w-full bg-slate-950 border border-slate-800 rounded-lg p-1.5 font-mono"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-[10px] text-slate-400">類型</label>
                        <select
                          className="w-full bg-slate-950 border border-slate-800 rounded-lg p-1.5"
                          value={activeNpc.type}
                          onChange={(e) => handleNpcEdit('type', Number(e.target.value))}
                        >
                          <option value={0}>站立</option>
                          <option value={4}>行走</option>
                        </select>
                      </div>
                      <div>
                        <label className="text-[10px] text-slate-400">朝向 (d)</label>
                        <select
                          className="w-full bg-slate-950 border border-slate-800 rounded-lg p-1.5"
                          value={activeNpc.d}
                          onChange={(e) => handleNpcEdit('d', Number(e.target.value))}
                        >
                          <option value={0}>下</option>
                          <option value={1}>左</option>
                          <option value={2}>右</option>
                          <option value={3}>上</option>
                        </select>
                      </div>
                    </div>

                    <div>
                      <label className="text-[10px] text-slate-400">對話事件索引 (e，對應 messages[e])</label>
                      <input
                        type="number"
                        value={activeNpc.e}
                        onChange={(e) => handleNpcEdit('e', Number(e.target.value))}
                        className="w-full bg-slate-950 border border-slate-800 rounded-lg p-1.5 font-mono"
                      />
                    </div>

                    <div>
                      <label className="text-[10px] text-slate-400">活動範圍 (aX / aY / aW / aH，行走型用)</label>
                      <div className="grid grid-cols-4 gap-1.5">
                        {(['aX', 'aY', 'aW', 'aH'] as const).map((field) => (
                          <input
                            key={field}
                            type="number"
                            value={activeNpc[field]}
                            onChange={(e) => handleNpcEdit(field, Number(e.target.value))}
                            className="w-full bg-slate-950 border border-slate-800 rounded-lg p-1.5 font-mono text-[10px]"
                            aria-label={field}
                          />
                        ))}
                      </div>
                    </div>

                    <div>
                      <label className="text-[10px] text-slate-400">步行速度 (footSpeed)</label>
                      <input
                        type="number"
                        value={activeNpc.footSpeed}
                        onChange={(e) => handleNpcEdit('footSpeed', Number(e.target.value))}
                        className="w-full bg-slate-950 border border-slate-800 rounded-lg p-1.5 font-mono"
                      />
                    </div>

                    <Button
                      className="w-full bg-red-600 hover:bg-red-700 text-white font-semibold"
                      onClick={() => store.deleteElement(3, store.objectNum)}
                      aria-label="刪除此 NPC"
                    >
                      <Trash2 className="h-4 w-4 mr-1.5" aria-hidden="true" />
                      刪除此 NPC
                    </Button>
                  </div>
                )}
              </div>
            ) : activeElement ? (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="font-semibold text-purple-400">
                    ℹ️ {store.mapObjects === 1 ? '貼圖物件' : '碰撞區域'} 屬性編輯
                  </h4>
                  <span className="text-[10px] text-slate-400 font-mono">ID: {store.objectNum}</span>
                </div>

                {store.mapObjects === 1 ? (
                  // MapTile (styles) Edit Panel
                  <>
                    <div>
                      <label className="text-[10px] text-slate-400">物件名稱</label>
                      <input 
                        type="text"
                        value={(activeElement as MapTile).n || ''}
                        onChange={(e) => handleTileEdit('n', e.target.value)}
                        className="w-full bg-slate-950 border border-slate-800 rounded-lg p-1.5 outline-none focus:border-purple-500"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-[10px] text-slate-400">畫布 X 座標</label>
                        <input 
                          type="number"
                          value={(activeElement as MapTile).l}
                          onChange={(e) => handleTileEdit('l', Number(e.target.value))}
                          className="w-full bg-slate-950 border border-slate-800 rounded-lg p-1.5 font-mono"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] text-slate-400">畫布 Y 座標</label>
                        <input 
                          type="number"
                          value={(activeElement as MapTile).t}
                          onChange={(e) => handleTileEdit('t', Number(e.target.value))}
                          className="w-full bg-slate-950 border border-slate-800 rounded-lg p-1.5 font-mono"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-[10px] text-slate-400">物件寬度</label>
                        <input 
                          type="number"
                          value={(activeElement as MapTile).w}
                          onChange={(e) => handleTileEdit('w', Number(e.target.value))}
                          className="w-full bg-slate-950 border border-slate-800 rounded-lg p-1.5 font-mono"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] text-slate-400">物件高度</label>
                        <input 
                          type="number"
                          value={(activeElement as MapTile).h}
                          onChange={(e) => handleTileEdit('h', Number(e.target.value))}
                          className="w-full bg-slate-950 border border-slate-800 rounded-lg p-1.5 font-mono"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-[10px] text-slate-400">圖庫 X 座標</label>
                        <input 
                          type="number"
                          readOnly
                          value={(activeElement as MapTile).x}
                          className="w-full bg-slate-950/40 border border-slate-800 rounded-lg p-1.5 font-mono text-slate-400"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] text-slate-400">圖庫 Y 座標</label>
                        <input 
                          type="number"
                          readOnly
                          value={(activeElement as MapTile).y}
                          className="w-full bg-slate-950/40 border border-slate-800 rounded-lg p-1.5 font-mono text-slate-400"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-[10px] text-slate-400">使用的圖庫</label>
                        <input 
                          type="text"
                          readOnly
                          value={(activeElement as MapTile).b === 0 ? 'NPC' : (activeElement as MapTile).b === 1 ? '拼圖一' : '拼圖二'}
                          className="w-full bg-slate-950/40 border border-slate-800 rounded-lg p-1.5 text-slate-400"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] text-slate-400">前後層屬性</label>
                        <select
                          className="w-full bg-slate-950 border border-slate-800 rounded-lg p-1.5"
                          value={(activeElement as MapTile).z === 2 ? '2' : '0'}
                          onChange={(e) => handleTileEdit('z', e.target.value === '2' ? 2 : undefined)}
                        >
                          <option value="0">後層 (背景層)</option>
                          <option value="2">前層 (遮罩前景)</option>
                        </select>
                      </div>
                    </div>
                  </>
                ) : (
                  // MapCollision (isMove) Edit Panel
                  <>
                    <div>
                      <label className="text-[10px] text-slate-400">區域名稱</label>
                      <input 
                        type="text"
                        value={(activeElement as MapCollision).n || ''}
                        onChange={(e) => handleCollisionEdit('n', e.target.value)}
                        className="w-full bg-slate-950 border border-slate-800 rounded-lg p-1.5 outline-none focus:border-purple-500"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-[10px] text-slate-400">X 座標</label>
                        <input 
                          type="number"
                          value={(activeElement as MapCollision).x}
                          onChange={(e) => handleCollisionEdit('x', Number(e.target.value))}
                          className="w-full bg-slate-950 border border-slate-800 rounded-lg p-1.5 font-mono"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] text-slate-400">Y 座標</label>
                        <input 
                          type="number"
                          value={(activeElement as MapCollision).y}
                          onChange={(e) => handleCollisionEdit('y', Number(e.target.value))}
                          className="w-full bg-slate-950 border border-slate-800 rounded-lg p-1.5 font-mono"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-[10px] text-slate-400">寬度</label>
                        <input 
                          type="number"
                          value={(activeElement as MapCollision).w}
                          onChange={(e) => handleCollisionEdit('w', Number(e.target.value))}
                          className="w-full bg-slate-950 border border-slate-800 rounded-lg p-1.5 font-mono"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] text-slate-400">高度</label>
                        <input 
                          type="number"
                          value={(activeElement as MapCollision).h}
                          onChange={(e) => handleCollisionEdit('h', Number(e.target.value))}
                          className="w-full bg-slate-950 border border-slate-800 rounded-lg p-1.5 font-mono"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="text-[10px] text-slate-400">觸發事件 ID</label>
                      <input 
                        type="number"
                        placeholder="無"
                        value={(activeElement as MapCollision).e ?? ''}
                        onChange={(e) => handleCollisionEdit('e', e.target.value !== '' ? Number(e.target.value) : undefined)}
                        className="w-full bg-slate-950 border border-slate-800 rounded-lg p-1.5 font-mono"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-[10px] text-slate-400">傳送地圖 ID</label>
                        <input 
                          type="number"
                          placeholder="無"
                          value={(activeElement as MapCollision).cm ?? ''}
                          onChange={(e) => handleCollisionEdit('cm', e.target.value !== '' ? Number(e.target.value) : undefined)}
                          className="w-full bg-slate-950 border border-slate-800 rounded-lg p-1.5 font-mono"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] text-slate-400">傳送地圖點</label>
                        <input 
                          type="number"
                          placeholder="無"
                          value={(activeElement as MapCollision).cmm ?? ''}
                          onChange={(e) => handleCollisionEdit('cmm', e.target.value !== '' ? Number(e.target.value) : undefined)}
                          className="w-full bg-slate-950 border border-slate-800 rounded-lg p-1.5 font-mono"
                        />
                      </div>
                    </div>
                  </>
                )}

                <div className="flex gap-2 pt-4">
                  <Button 
                    className="flex-1 bg-red-600 hover:bg-red-700 text-white font-semibold focus-visible:ring-2 focus-visible:ring-purple-500 outline-none"
                    onClick={() => {
                      if (store.mapObjects !== null) {
                        store.deleteElement(store.mapObjects, store.objectNum)
                      }
                    }}
                    aria-label="刪除此物件"
                  >
                    <Trash2 className="h-4 w-4 mr-1.5" aria-hidden="true" />
                    刪除此物件
                  </Button>
                </div>
              </div>
            ) : (
              <div className="h-48 flex flex-col items-center justify-center border border-dashed border-slate-800 rounded-xl text-slate-500 bg-slate-950/20">
                <Info className="h-6 w-6 mb-2 text-slate-600" aria-hidden="true" />
                <p className="text-center px-4">請點選畫布上的貼圖物件或碰撞區域進行視察</p>
              </div>
            )}

            {/* Screenshots & Quick tools */}
            <div className="space-y-2 border-t border-slate-800 pt-4">
              <h4 className="font-semibold text-slate-300">📸 匯出場景快照</h4>
              <div className="grid grid-cols-2 gap-2">
                <Button 
                  size="sm"
                  variant="outline"
                  onClick={() => exportCanvas('B')}
                  className="h-8 border-slate-800 text-[10px] text-slate-300 hover:text-white focus-visible:ring-2 focus-visible:ring-purple-500 outline-none"
                  aria-label="導出背景層圖片"
                >
                  <Download className="h-3 w-3 mr-1" aria-hidden="true" />
                  導出背景層 (.png)
                </Button>
                <Button 
                  size="sm"
                  variant="outline"
                  onClick={() => exportCanvas('F')}
                  className="h-8 border-slate-800 text-[10px] text-slate-300 hover:text-white focus-visible:ring-2 focus-visible:ring-purple-500 outline-none"
                  aria-label="導出前景層圖片"
                >
                  <Download className="h-3 w-3 mr-1" aria-hidden="true" />
                  導出前景層 (.png)
                </Button>
              </div>
            </div>

          </div>
        </div>

      </div>

      {/* Help Modal Overlay */}
      {showHelpModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 max-w-md w-full shadow-2xl animate-scale-in">
            <div className="flex items-center gap-3 mb-4">
              <Keyboard className="h-6 w-6 text-purple-400" aria-hidden="true" />
              <h3 className="text-lg font-bold text-white">地圖編輯器 快速鍵說明</h3>
            </div>
            
            <div className="space-y-3.5 text-xs text-slate-300">
              <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                <span>網格線切換</span>
                <kbd className="px-2.5 py-1 rounded bg-slate-950 text-emerald-400 border border-slate-800 font-mono text-[10px]">G</kbd>
              </div>
              <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                <span>前景遮罩顯示/隱藏</span>
                <kbd className="px-2.5 py-1 rounded bg-slate-950 text-emerald-400 border border-slate-800 font-mono text-[10px]">F</kbd>
              </div>
              <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                <span>背景底圖顯示/隱藏</span>
                <kbd className="px-2.5 py-1 rounded bg-slate-950 text-emerald-400 border border-slate-800 font-mono text-[10px]">B</kbd>
              </div>
              <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                <span>碰撞區域顯示/隱藏</span>
                <kbd className="px-2.5 py-1 rounded bg-slate-950 text-emerald-400 border border-slate-800 font-mono text-[10px]">M</kbd>
              </div>
              <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                <span>畫布平移控制</span>
                <kbd className="px-2.5 py-1 rounded bg-slate-950 text-emerald-400 border border-slate-800 font-mono text-[10px]">W / A / S / D 或 方向鍵</kbd>
              </div>
              <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                <span>刪除選取之物件</span>
                <kbd className="px-2.5 py-1 rounded bg-slate-950 text-emerald-400 border border-slate-800 font-mono text-[10px]">Delete</kbd>
              </div>
              <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                <span>快速劃分碰撞區域</span>
                <kbd className="px-2.5 py-1 rounded bg-slate-950 text-emerald-400 border border-slate-800 font-mono text-[10px]">Alt + 滑鼠左鍵拖曳</kbd>
              </div>
              <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                <span>儲存地圖至本地暫存</span>
                <kbd className="px-2.5 py-1 rounded bg-slate-950 text-emerald-400 border border-slate-800 font-mono text-[10px]">Alt + S</kbd>
              </div>
              <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                <span>自本地載入暫存紀錄</span>
                <kbd className="px-2.5 py-1 rounded bg-slate-950 text-emerald-400 border border-slate-800 font-mono text-[10px]">Alt + L</kbd>
              </div>
              <div className="flex items-center justify-between">
                <span>清除地圖與碰撞區</span>
                <kbd className="px-2.5 py-1 rounded bg-slate-950 text-emerald-400 border border-slate-800 font-mono text-[10px]">Alt + C</kbd>
              </div>
            </div>
            
            <div className="mt-6 flex justify-end">
              <Button 
                onClick={() => setShowHelpModal(false)}
                className="bg-purple-600 hover:bg-purple-700 text-white font-semibold"
              >
                關閉說明
              </Button>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}

export default MapDeveloper
