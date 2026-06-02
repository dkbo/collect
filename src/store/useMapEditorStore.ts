import { create } from 'zustand'

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
  // Map dimensions
  width: number
  height: number
  
  // Workarea translations
  mapLeft: number
  mapTop: number
  
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
  
  // Active document data
  styles: MapTile[]
  isMoveArr: MapCollision[]
  npcArr: unknown[]
  
  // Active editor modes & selections
  mapObjects: 1 | 2 | null // 1 = styles (tiles), 2 = isMove (collision), null = none
  objectNum: number        // index of the selected item in the active array
  objectName: string       // active object name to place
  immediate: boolean       // immediate update drawing flag
  
  // Actions
  setMapSize: (w: number, h: number) => void
  setMapOffset: (left: number, top: number) => void
  panMap: (dx: number, dy: number) => void
  setOpacity: (layer: 'F' | 'B' | 'M', val: number) => void
  toggleGrid: (axis: 'X' | 'Y') => void
  
  selectSpriteSheet: (sheet: number) => void
  setSpriteSelection: (x: number | false, y: number | false, w?: number, h?: number) => void
  setSpriteScrollTop: (top: number) => void
  
  // Element drawing
  addTile: (tile: MapTile) => void
  addCollision: (collision: MapCollision) => void
  deleteElement: (type: 1 | 2, index: number) => void
  selectElement: (type: 1 | 2 | null, index: number) => void
  updateElementProps: (type: 1 | 2, index: number, props: Partial<MapTile> & Partial<MapCollision>) => void
  setObjectName: (name: string) => void
  setImmediate: (val: boolean) => void
  
  // Load / Save JSON
  loadMapJson: (json: {
    map?: { width?: number; height?: number }
    styles?: MapTile[]
    isMove?: MapCollision[]
    npc?: unknown[]
  }) => boolean
  clearMap: () => void
  saveToLocalStorage: () => void
  loadFromLocalStorage: () => void
}

export const useMapEditorStore = create<MapEditorState>((set, get) => ({
  // Map dimensions
  width: 1920,
  height: 1280,
  
  // Workarea translations
  mapLeft: 0,
  mapTop: 0,
  
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
  
  // Active document data
  styles: [],
  isMoveArr: [],
  npcArr: [],
  
  // Active editor modes & selections
  mapObjects: null,
  objectNum: 0,
  objectName: '',
  immediate: false,

  // Actions
  setMapSize: (width, height) => set({ width, height }),
  
  setMapOffset: (mapLeft, mapTop) => set({ mapLeft, mapTop }),
  
  panMap: (dx, dy) => set((state) => ({
    mapLeft: state.mapLeft + dx,
    mapTop: state.mapTop + dy
  })),
  
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
    sourceH: h
  }),
  
  setSpriteScrollTop: (spriteScrollTop) => set({ spriteScrollTop }),
  
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
    } else {
      const copy = [...state.isMoveArr]
      copy.splice(index, 1)
      return {
        isMoveArr: copy,
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
  
  loadMapJson: (json) => {
    if (!json) return false
    try {
      const mapWidth = json.map?.width || get().width
      const mapHeight = json.map?.height || get().height
      const styles = Array.isArray(json.styles) ? json.styles : []
      const isMoveArr = Array.isArray(json.isMove) ? json.isMove : []
      const npcArr = Array.isArray(json.npc) ? json.npc : []
      
      set({
        width: mapWidth,
        height: mapHeight,
        styles,
        isMoveArr,
        npcArr,
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
    mapObjects: null,
    objectNum: 0
  }),
  
  saveToLocalStorage: () => {
    const state = get()
    const map = {
      width: state.width,
      height: state.height
    }
    const json = {
      map,
      styles: state.styles,
      isMove: state.isMoveArr,
      npc: state.npcArr
    }
    localStorage.setItem('dkbo', JSON.stringify(json))
    localStorage.setItem('dkbomap', JSON.stringify(map))
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
