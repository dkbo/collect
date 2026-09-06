import { create } from 'zustand'
import type { MapNpc, NpcMessage, SpawnPoint } from '@/lib/rpg/types'

// 工作區縮放範圍
const MIN_SCALE = 0.25
const MAX_SCALE = 3

export interface MapTile {
  n: string   // name
  l: number   // map left X
  t: number   // map top Y
  w: number   // width
  h: number   // height
  b: number   // sprite sheet index (0: NPC, 1: 拼圖一, 2: 拼圖二)
  x: number   // sprite source X
  y: number   // sprite source Y
  z?: number  // layer (2: foreground/front, 0 or undefined: background/back)
  rx?: number // repeat along X (壓縮欄位)
  ry?: number // repeat along Y (壓縮欄位)
}

export interface MapCollision {
  n: string    // collision name
  x: number    // map X
  y: number    // map Y
  w: number    // width
  h: number    // height
  e?: number   // event ID
  cm?: number  // teleport map ID
  cmm?: number // teleport map point ID
}

interface MapEditorState {
  // Map metadata
  mapIndex: number
  mapName: string
  inArr: SpawnPoint[]

  // Map dimensions
  width: number
  height: number

  // Workarea translations
  mapLeft: number
  mapTop: number
  scale: number

  // Layer visibility & settings
  opacityF: number // front layer (0 to 1)
  opacityB: number // back layer (0 to 1)
  opacityM: number // collision/move layer (0 to 1)
  gridX: boolean
  gridY: boolean
  
  // Sprite selection source properties
  sprites: number // selected sprite sheet index
  sourceX: number | false
  sourceY: number | false
  sourceW: number
  sourceH: number
  
  // Sprite list scroll position
  spriteScrollTop: number

  // Palette highlight（地圖選取物件時反查圖庫來源，與 sourceX/sourceY 分離以維持選取模式）
  highlightX: number | false
  highlightY: number | false
  highlightW: number
  highlightH: number

  // Active document data
  styles: MapTile[]
  isMoveArr: MapCollision[]
  npcArr: MapNpc[]
  messagesArr: NpcMessage[]

  // Active editor modes & selections
  mapObjects: 1 | 2 | 3 | null // 1 = styles (tiles), 2 = isMove (collision), 3 = npc, null = none
  objectNum: number        // index of the selected item in the active array
  objectName: string       // active object name to place
  immediate: boolean       // immediate update drawing flag

  // Actions
  setMapMeta: (index: number, name: string) => void
  addSpawnPoint: (point: SpawnPoint) => void
  updateSpawnPoint: (index: number, point: Partial<SpawnPoint>) => void
  deleteSpawnPoint: (index: number) => void
  addNpc: (npc: MapNpc) => void
  updateNpcProps: (index: number, props: Partial<MapNpc>) => void
  setMapSize: (w: number, h: number) => void
  setMapOffset: (left: number, top: number) => void
  panMap: (dx: number, dy: number) => void
  zoomAt: (factor: number, anchorX: number, anchorY: number) => void
  resetView: () => void
  setOpacity: (layer: 'F' | 'B' | 'M', val: number) => void
  toggleGrid: (axis: 'X' | 'Y') => void
  
  selectSpriteSheet: (sheet: number) => void
  setSpriteSelection: (x: number | false, y: number | false, w?: number, h?: number) => void
  setSpriteScrollTop: (top: number) => void
  setPaletteHighlight: (x: number | false, y: number | false, w?: number, h?: number) => void
  
  // Element drawing
  addTile: (tile: MapTile) => void
  addCollision: (collision: MapCollision) => void
  deleteElement: (type: 1 | 2 | 3, index: number) => void
  selectElement: (type: 1 | 2 | 3 | null, index: number) => void
  updateElementProps: (type: 1 | 2, index: number, props: Partial<MapTile> & Partial<MapCollision>) => void
  setObjectName: (name: string) => void
  setImmediate: (val: boolean) => void

  // Load / Save JSON
  exportMapJson: () => {
    map: { index: number; name: string; width: number; height: number; in: SpawnPoint[] }
    styles: MapTile[]
    isMove: MapCollision[]
    npc: MapNpc[]
    messages: NpcMessage[]
  }
  loadMapJson: (json: {
    map?: { index?: number; name?: string; width?: number; height?: number; in?: SpawnPoint[] }
    styles?: MapTile[]
    isMove?: MapCollision[]
    npc?: MapNpc[]
    messages?: NpcMessage[]
  }) => boolean
  clearMap: () => void
  saveToLocalStorage: () => void
  loadFromLocalStorage: () => void
}

export const useMapEditorStore = create<MapEditorState>((set, get) => ({
  // Map metadata
  mapIndex: 0,
  mapName: '新地圖',
  inArr: [],

  // Map dimensions
  width: 1920,
  height: 1280,

  // Workarea translations
  mapLeft: 0,
  mapTop: 0,
  scale: 1,

  // Layer visibility & settings
  opacityF: 1,
  opacityB: 1,
  opacityM: 1,
  gridX: false,
  gridY: false,
  
  // Sprite selection source properties
  sprites: 1, // Default sprite sheet 1
  sourceX: false,
  sourceY: false,
  sourceW: 32,
  sourceH: 32,
  
  // Sprite list scroll position
  spriteScrollTop: 0,

  // Palette highlight
  highlightX: false,
  highlightY: false,
  highlightW: 32,
  highlightH: 32,

  // Active document data
  styles: [],
  isMoveArr: [],
  npcArr: [],
  messagesArr: [],

  // Active editor modes & selections
  mapObjects: null,
  objectNum: 0,
  objectName: '',
  immediate: false,

  // Actions
  setMapMeta: (mapIndex, mapName) => set({ mapIndex, mapName }),

  addSpawnPoint: (point) => set((state) => ({ inArr: [...state.inArr, point] })),

  updateSpawnPoint: (index, point) => set((state) => {
    const copy = [...state.inArr]
    if (copy[index]) copy[index] = { ...copy[index], ...point }
    return { inArr: copy }
  }),

  deleteSpawnPoint: (index) => set((state) => {
    const copy = [...state.inArr]
    copy.splice(index, 1)
    return { inArr: copy }
  }),

  addNpc: (npc) => set((state) => {
    const updated = [...state.npcArr, npc]
    return { npcArr: updated, mapObjects: 3, objectNum: updated.length - 1 }
  }),

  updateNpcProps: (index, props) => set((state) => {
    const copy = [...state.npcArr]
    if (copy[index]) copy[index] = { ...copy[index], ...props }
    return { npcArr: copy }
  }),

  setMapSize: (width, height) => set({ width, height }),
  
  setMapOffset: (mapLeft, mapTop) => set({ mapLeft, mapTop }),
  
  panMap: (dx, dy) => set((state) => ({
    mapLeft: state.mapLeft + dx,
    mapTop: state.mapTop + dy
  })),

  // 以錨點（相對工作區左上的螢幕座標）為中心縮放，錨點下的地圖點維持不動
  zoomAt: (factor, anchorX, anchorY) => set((state) => {
    const next = Math.min(MAX_SCALE, Math.max(MIN_SCALE, state.scale * factor))
    if (next === state.scale) return {}
    const k = next / state.scale
    return {
      scale: next,
      mapLeft: anchorX - (anchorX - state.mapLeft) * k,
      mapTop: anchorY - (anchorY - state.mapTop) * k
    }
  }),

  resetView: () => set({ scale: 1, mapLeft: 0, mapTop: 0 }),

  setOpacity: (layer, val) => {
    if (layer === 'F') set({ opacityF: val })
    else if (layer === 'B') set({ opacityB: val })
    else set({ opacityM: val })
  },
  
  toggleGrid: (axis) => set((state) => {
    if (axis === 'X') return { gridX: !state.gridX }
    return { gridY: !state.gridY }
  }),
  
  selectSpriteSheet: (sprites) => set({ 
    sprites, 
    sourceX: false, 
    sourceY: false, 
    sourceW: 32, 
    sourceH: 32 
  }),
  
  setSpriteSelection: (x, y, w = 32, h = 32) => set({
    sourceX: x,
    sourceY: y,
    sourceW: w,
    sourceH: h,
    // 手動選取素材時清除反查高亮
    highlightX: false,
    highlightY: false
  }),

  setSpriteScrollTop: (spriteScrollTop) => set({ spriteScrollTop }),

  setPaletteHighlight: (x, y, w = 32, h = 32) => set({
    highlightX: x,
    highlightY: y,
    highlightW: w,
    highlightH: h
  }),
  
  addTile: (tile) => set((state) => {
    const updatedStyles = [...state.styles, tile]
    return {
      styles: updatedStyles,
      mapObjects: 1,
      objectNum: updatedStyles.length - 1
    }
  }),
  
  addCollision: (collision) => set((state) => {
    const updatedCollision = [...state.isMoveArr, collision]
    return {
      isMoveArr: updatedCollision,
      mapObjects: 2,
      objectNum: updatedCollision.length - 1
    }
  }),
  
  deleteElement: (type, index) => set((state) => {
    if (type === 1) {
      const copy = [...state.styles]
      copy.splice(index, 1)
      return {
        styles: copy,
        mapObjects: null,
        objectNum: 0
      }
    } else if (type === 2) {
      const copy = [...state.isMoveArr]
      copy.splice(index, 1)
      return {
        isMoveArr: copy,
        mapObjects: null,
        objectNum: 0
      }
    } else {
      const copy = [...state.npcArr]
      copy.splice(index, 1)
      return {
        npcArr: copy,
        mapObjects: null,
        objectNum: 0
      }
    }
  }),
  
  selectElement: (type, index) => set({
    mapObjects: type,
    objectNum: index
  }),
  
  updateElementProps: (type, index, props) => set((state) => {
    if (type === 1) {
      const copy = [...state.styles]
      if (copy[index]) {
        copy[index] = { ...copy[index], ...props }
      }
      return { styles: copy }
    } else {
      const copy = [...state.isMoveArr]
      if (copy[index]) {
        copy[index] = { ...copy[index], ...props as Partial<MapCollision> }
      }
      return { isMoveArr: copy }
    }
  }),
  
  setObjectName: (objectName) => set({ objectName }),
  
  setImmediate: (immediate) => set({ immediate }),
  
  exportMapJson: () => {
    const state = get()
    // 完整 schema：與 RpgRoom data/000N_map.json 相同，匯出即可直接使用
    return {
      map: {
        index: state.mapIndex,
        name: state.mapName,
        width: state.width,
        height: state.height,
        in: state.inArr,
      },
      styles: state.styles,
      isMove: state.isMoveArr,
      npc: state.npcArr,
      messages: state.messagesArr,
    }
  },

  loadMapJson: (json) => {
    if (!json) return false
    try {
      const mapWidth = json.map?.width || get().width
      const mapHeight = json.map?.height || get().height
      const styles = Array.isArray(json.styles) ? json.styles : []
      const isMoveArr = Array.isArray(json.isMove) ? json.isMove : []
      const npcArr = Array.isArray(json.npc) ? json.npc : []
      const messagesArr = Array.isArray(json.messages) ? json.messages : []

      set({
        mapIndex: json.map?.index ?? get().mapIndex,
        mapName: json.map?.name ?? get().mapName,
        inArr: Array.isArray(json.map?.in) ? json.map.in : [],
        width: mapWidth,
        height: mapHeight,
        styles,
        isMoveArr,
        npcArr,
        messagesArr,
        mapObjects: null,
        objectNum: 0
      })
      return true
    } catch (e) {
      console.error('Failed to parse loadMapJson', e)
      return false
    }
  },

  clearMap: () => set({
    styles: [],
    isMoveArr: [],
    npcArr: [],
    messagesArr: [],
    inArr: [],
    mapObjects: null,
    objectNum: 0
  }),

  saveToLocalStorage: () => {
    const state = get()
    const json = state.exportMapJson()
    localStorage.setItem('dkbo', JSON.stringify(json))
    localStorage.setItem('dkbomap', JSON.stringify({ width: state.width, height: state.height }))
  },
  
  loadFromLocalStorage: () => {
    try {
      const dkbomapStr = localStorage.getItem('dkbomap')
      const dkboStr = localStorage.getItem('dkbo')
      if (dkbomapStr && dkboStr) {
        const map = JSON.parse(dkbomapStr)
        const json = JSON.parse(dkboStr)
        set({
          width: map.width || 1920,
          height: map.height || 1280
        })
        get().loadMapJson(json)
      }
    } catch (e) {
      console.error('Failed to load map from local storage', e)
    }
  }
}))

export default useMapEditorStore
