import { describe, it, expect, beforeEach } from 'vitest'
import { useMapEditorStore, type MapTile, type MapCollision } from './useMapEditorStore'
import type { MapNpc } from '@/pages/RpgRoom/types'

const initialState = useMapEditorStore.getState()

const makeTile = (overrides: Partial<MapTile> = {}): MapTile => ({
  n: 'tile', l: 0, t: 0, w: 32, h: 32, b: 1, x: 0, y: 0, ...overrides,
})

const makeCollision = (overrides: Partial<MapCollision> = {}): MapCollision => ({
  n: 'wall', x: 0, y: 0, w: 32, h: 32, ...overrides,
})

const makeNpc = (overrides: Partial<MapNpc> = {}): MapNpc => ({
  b: 0, type: 0, pX: 0, pY: 0, aX: 0, aY: 0, aW: 0, aH: 0,
  mX: 0, mY: 0, x: 0, y: 0, w: 32, h: 32, d: 0,
  l: 0, r: 0, u: 0, t: 0, s: 0, f: 0, footSpeed: 1,
  isR: false, isU: false, isD: false, isL: false, isM: false, e: 0,
  ...overrides,
})

describe('useMapEditorStore', () => {
  beforeEach(() => {
    useMapEditorStore.setState(initialState, true)
  })

  it('setMapMeta updates index/name', () => {
    useMapEditorStore.getState().setMapMeta(3, '新地圖3')
    expect(useMapEditorStore.getState()).toMatchObject({ mapIndex: 3, mapName: '新地圖3' })
  })

  describe('spawn points', () => {
    it('addSpawnPoint appends, updateSpawnPoint merges, deleteSpawnPoint removes by index', () => {
      const { addSpawnPoint, updateSpawnPoint, deleteSpawnPoint } = useMapEditorStore.getState()
      addSpawnPoint({ x: 1, y: 1 })
      addSpawnPoint({ x: 2, y: 2 })
      expect(useMapEditorStore.getState().inArr).toEqual([{ x: 1, y: 1 }, { x: 2, y: 2 }])

      updateSpawnPoint(0, { x: 9 })
      expect(useMapEditorStore.getState().inArr[0]).toEqual({ x: 9, y: 1 })

      deleteSpawnPoint(0)
      expect(useMapEditorStore.getState().inArr).toEqual([{ x: 2, y: 2 }])
    })

    it('updateSpawnPoint on an out-of-range index is a no-op', () => {
      useMapEditorStore.getState().addSpawnPoint({ x: 1, y: 1 })
      useMapEditorStore.getState().updateSpawnPoint(5, { x: 9 })
      expect(useMapEditorStore.getState().inArr).toEqual([{ x: 1, y: 1 }])
    })
  })

  it('addNpc appends and selects it as the active object (mapObjects=3)', () => {
    useMapEditorStore.getState().addNpc(makeNpc())
    const state = useMapEditorStore.getState()
    expect(state.npcArr).toHaveLength(1)
    expect(state.mapObjects).toBe(3)
    expect(state.objectNum).toBe(0)
  })

  it('updateNpcProps merges props into the matching npc only', () => {
    useMapEditorStore.setState({ npcArr: [makeNpc({ pX: 1 }), makeNpc({ pX: 2 })] })
    useMapEditorStore.getState().updateNpcProps(1, { pX: 99 })
    const { npcArr } = useMapEditorStore.getState()
    expect(npcArr[0].pX).toBe(1)
    expect(npcArr[1].pX).toBe(99)
  })

  it('setMapSize / setMapOffset set absolute values; panMap accumulates relative deltas', () => {
    const { setMapSize, setMapOffset, panMap } = useMapEditorStore.getState()
    setMapSize(640, 480)
    setMapOffset(10, 20)
    panMap(5, -5)
    expect(useMapEditorStore.getState()).toMatchObject({ width: 640, height: 480, mapLeft: 15, mapTop: 15 })
  })

  describe('zoomAt', () => {
    it('scales around the anchor point so the map point under the anchor stays fixed', () => {
      useMapEditorStore.getState().zoomAt(2, 100, 100)
      const state = useMapEditorStore.getState()
      expect(state.scale).toBe(2)
      // anchor(100,100) - (anchor - oldLeft(0)) * k(2) = 100 - 100*2 = -100
      expect(state.mapLeft).toBe(-100)
      expect(state.mapTop).toBe(-100)
    })

    it('clamps to MAX_SCALE and is a no-op (state unchanged) once already at the clamp', () => {
      useMapEditorStore.getState().zoomAt(100, 0, 0)
      expect(useMapEditorStore.getState().scale).toBe(3)

      const before = useMapEditorStore.getState()
      useMapEditorStore.getState().zoomAt(100, 0, 0)
      const after = useMapEditorStore.getState()
      expect(after.mapLeft).toBe(before.mapLeft)
      expect(after.mapTop).toBe(before.mapTop)
    })

    it('clamps to MIN_SCALE on repeated zoom-out', () => {
      useMapEditorStore.getState().zoomAt(0.01, 0, 0)
      expect(useMapEditorStore.getState().scale).toBe(0.25)
    })
  })

  it('resetView restores scale/pan to defaults', () => {
    useMapEditorStore.setState({ scale: 2, mapLeft: 50, mapTop: 50 })
    useMapEditorStore.getState().resetView()
    expect(useMapEditorStore.getState()).toMatchObject({ scale: 1, mapLeft: 0, mapTop: 0 })
  })

  it('setOpacity updates only the targeted layer', () => {
    const { setOpacity } = useMapEditorStore.getState()
    setOpacity('F', 0.5)
    setOpacity('B', 0.2)
    setOpacity('M', 0)
    expect(useMapEditorStore.getState()).toMatchObject({ opacityF: 0.5, opacityB: 0.2, opacityM: 0 })
  })

  it('toggleGrid flips only the targeted axis', () => {
    useMapEditorStore.getState().toggleGrid('X')
    expect(useMapEditorStore.getState()).toMatchObject({ gridX: true, gridY: false })
    useMapEditorStore.getState().toggleGrid('Y')
    expect(useMapEditorStore.getState()).toMatchObject({ gridX: true, gridY: true })
  })

  it('selectSpriteSheet resets the source selection to defaults', () => {
    useMapEditorStore.setState({ sourceX: 64, sourceY: 64, sourceW: 16, sourceH: 16 })
    useMapEditorStore.getState().selectSpriteSheet(2)
    expect(useMapEditorStore.getState()).toMatchObject({
      sprites: 2, sourceX: false, sourceY: false, sourceW: 32, sourceH: 32,
    })
  })

  it('setSpriteSelection sets source coords and clears palette highlight', () => {
    useMapEditorStore.setState({ highlightX: 10, highlightY: 10 })
    useMapEditorStore.getState().setSpriteSelection(5, 5, 16, 16)
    expect(useMapEditorStore.getState()).toMatchObject({
      sourceX: 5, sourceY: 5, sourceW: 16, sourceH: 16, highlightX: false, highlightY: false,
    })
  })

  it('setPaletteHighlight sets highlight coords with default w/h', () => {
    useMapEditorStore.getState().setPaletteHighlight(7, 7)
    expect(useMapEditorStore.getState()).toMatchObject({ highlightX: 7, highlightY: 7, highlightW: 32, highlightH: 32 })
  })

  it('setSpriteScrollTop stores the scroll position', () => {
    useMapEditorStore.getState().setSpriteScrollTop(120)
    expect(useMapEditorStore.getState().spriteScrollTop).toBe(120)
  })

  it('addTile appends and selects it as active object (mapObjects=1)', () => {
    useMapEditorStore.getState().addTile(makeTile())
    const state = useMapEditorStore.getState()
    expect(state.styles).toHaveLength(1)
    expect(state.mapObjects).toBe(1)
    expect(state.objectNum).toBe(0)
  })

  it('addCollision appends and selects it as active object (mapObjects=2)', () => {
    useMapEditorStore.getState().addCollision(makeCollision())
    const state = useMapEditorStore.getState()
    expect(state.isMoveArr).toHaveLength(1)
    expect(state.mapObjects).toBe(2)
  })

  describe('deleteElement', () => {
    it('removes a tile (type 1) and clears selection', () => {
      useMapEditorStore.setState({ styles: [makeTile()], mapObjects: 1, objectNum: 0 })
      useMapEditorStore.getState().deleteElement(1, 0)
      const state = useMapEditorStore.getState()
      expect(state.styles).toHaveLength(0)
      expect(state.mapObjects).toBeNull()
    })

    it('removes a collision (type 2)', () => {
      useMapEditorStore.setState({ isMoveArr: [makeCollision()] })
      useMapEditorStore.getState().deleteElement(2, 0)
      expect(useMapEditorStore.getState().isMoveArr).toHaveLength(0)
    })

    it('removes an npc (type 3)', () => {
      useMapEditorStore.setState({ npcArr: [makeNpc()] })
      useMapEditorStore.getState().deleteElement(3, 0)
      expect(useMapEditorStore.getState().npcArr).toHaveLength(0)
    })
  })

  it('selectElement sets the active type and index', () => {
    useMapEditorStore.getState().selectElement(2, 4)
    expect(useMapEditorStore.getState()).toMatchObject({ mapObjects: 2, objectNum: 4 })
  })

  describe('updateElementProps', () => {
    it('merges props into a tile (type 1)', () => {
      useMapEditorStore.setState({ styles: [makeTile({ n: 'a' })] })
      useMapEditorStore.getState().updateElementProps(1, 0, { n: 'b' })
      expect(useMapEditorStore.getState().styles[0].n).toBe('b')
    })

    it('merges props into a collision (type 2)', () => {
      useMapEditorStore.setState({ isMoveArr: [makeCollision({ n: 'a' })] })
      useMapEditorStore.getState().updateElementProps(2, 0, { n: 'b' })
      expect(useMapEditorStore.getState().isMoveArr[0].n).toBe('b')
    })

    it('is a no-op for an out-of-range index', () => {
      useMapEditorStore.setState({ styles: [makeTile({ n: 'a' })] })
      useMapEditorStore.getState().updateElementProps(1, 5, { n: 'b' })
      expect(useMapEditorStore.getState().styles[0].n).toBe('a')
    })
  })

  it('setObjectName / setImmediate set their respective fields', () => {
    useMapEditorStore.getState().setObjectName('door')
    useMapEditorStore.getState().setImmediate(true)
    expect(useMapEditorStore.getState()).toMatchObject({ objectName: 'door', immediate: true })
  })

  it('exportMapJson serializes current state into the RpgRoom map JSON schema', () => {
    useMapEditorStore.setState({
      mapIndex: 1, mapName: '房間', width: 100, height: 200,
      inArr: [{ x: 1, y: 1 }], styles: [makeTile()], isMoveArr: [makeCollision()],
      npcArr: [makeNpc()], messagesArr: [{ name: 'npc', text: ['hi'] }],
    })

    expect(useMapEditorStore.getState().exportMapJson()).toEqual({
      map: { index: 1, name: '房間', width: 100, height: 200, in: [{ x: 1, y: 1 }] },
      styles: [makeTile()],
      isMove: [makeCollision()],
      npc: [makeNpc()],
      messages: [{ name: 'npc', text: ['hi'] }],
    })
  })

  describe('loadMapJson', () => {
    it('loads a well-formed map JSON and resets the active selection', () => {
      useMapEditorStore.setState({ mapObjects: 1, objectNum: 3 })
      const ok = useMapEditorStore.getState().loadMapJson({
        map: { index: 2, name: 'X', width: 50, height: 60, in: [{ x: 0, y: 0 }] },
        styles: [makeTile()],
        isMove: [makeCollision()],
        npc: [makeNpc()],
        messages: [],
      })
      expect(ok).toBe(true)
      const state = useMapEditorStore.getState()
      expect(state).toMatchObject({ mapIndex: 2, mapName: 'X', width: 50, height: 60, mapObjects: null, objectNum: 0 })
      expect(state.styles).toHaveLength(1)
    })

    it('falls back to empty arrays and current width/height when fields are missing', () => {
      const ok = useMapEditorStore.getState().loadMapJson({})
      expect(ok).toBe(true)
      const state = useMapEditorStore.getState()
      expect(state.styles).toEqual([])
      expect(state.isMoveArr).toEqual([])
      expect(state.npcArr).toEqual([])
      expect(state.inArr).toEqual([])
    })

    it('returns false and leaves state untouched when json is falsy', () => {
      useMapEditorStore.setState({ mapName: 'kept' })
      const ok = useMapEditorStore.getState().loadMapJson(null as never)
      expect(ok).toBe(false)
      expect(useMapEditorStore.getState().mapName).toBe('kept')
    })
  })

  it('clearMap empties all element arrays and selection', () => {
    useMapEditorStore.setState({
      styles: [makeTile()], isMoveArr: [makeCollision()], npcArr: [makeNpc()],
      messagesArr: [{ name: 'a', text: ['b'] }], inArr: [{ x: 1, y: 1 }],
      mapObjects: 1, objectNum: 2,
    })
    useMapEditorStore.getState().clearMap()
    const state = useMapEditorStore.getState()
    expect(state.styles).toEqual([])
    expect(state.isMoveArr).toEqual([])
    expect(state.npcArr).toEqual([])
    expect(state.messagesArr).toEqual([])
    expect(state.inArr).toEqual([])
    expect(state.mapObjects).toBeNull()
  })

  describe('localStorage persistence', () => {
    beforeEach(() => localStorage.clear())

    it('saveToLocalStorage writes exported json and map size under fixed keys', () => {
      useMapEditorStore.setState({ width: 320, height: 240, mapName: 'saved' })
      useMapEditorStore.getState().saveToLocalStorage()

      expect(JSON.parse(localStorage.getItem('dkbomap')!)).toEqual({ width: 320, height: 240 })
      expect(JSON.parse(localStorage.getItem('dkbo')!).map.name).toBe('saved')
    })

    it('loadFromLocalStorage restores size and map json when both keys are present', () => {
      localStorage.setItem('dkbomap', JSON.stringify({ width: 800, height: 600 }))
      localStorage.setItem('dkbo', JSON.stringify({
        map: { index: 9, name: 'loaded', width: 800, height: 600, in: [] },
        styles: [], isMove: [], npc: [], messages: [],
      }))

      useMapEditorStore.getState().loadFromLocalStorage()

      expect(useMapEditorStore.getState()).toMatchObject({ width: 800, height: 600, mapName: 'loaded', mapIndex: 9 })
    })

    it('does nothing when localStorage keys are missing (ignore path)', () => {
      useMapEditorStore.getState().loadFromLocalStorage()
      expect(useMapEditorStore.getState().mapName).toBe(initialState.mapName)
    })

    it('does not throw and ignores malformed JSON in localStorage', () => {
      localStorage.setItem('dkbomap', 'not-json')
      localStorage.setItem('dkbo', 'not-json')
      expect(() => useMapEditorStore.getState().loadFromLocalStorage()).not.toThrow()
    })
  })
})
