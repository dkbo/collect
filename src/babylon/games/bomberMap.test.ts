import { describe, it, expect } from 'vitest'
import {
  GRID_W,
  GRID_H,
  TILE_EMPTY,
  TILE_WALL,
  TILE_CRATE,
  TILE_CRATE_HARD,
  SPAWN_CORNERS,
  cellIndex,
  inBounds,
  isBlocked,
  mulberry32,
  generateMap,
  blastCells,
} from './bomberMap'

/**
 * bomberMap 純邏輯測試：PRNG 決定性、地圖不變式（柱牆／出生角淨空／合法 tile）、
 * 爆炸截斷規則（牆／軟箱／硬箱／場外）。全部手工造資料，不依賴引擎。
 */

/** 空地圖（無牆無箱），依需要再手動填格 */
const emptyMap = (): Uint8Array => new Uint8Array(GRID_W * GRID_H)

describe('mulberry32', () => {
  it('同 seed 產出同序列', () => {
    const a = mulberry32(42)
    const b = mulberry32(42)
    const seqA = [a(), a(), a(), a()]
    const seqB = [b(), b(), b(), b()]
    expect(seqA).toEqual(seqB)
  })

  it('值域在 [0, 1)', () => {
    const rand = mulberry32(1)
    for (let i = 0; i < 200; i++) {
      const v = rand()
      expect(v).toBeGreaterThanOrEqual(0)
      expect(v).toBeLessThan(1)
    }
  })
})

describe('generateMap 決定性', () => {
  it('同 seed 兩次逐 byte 相等', () => {
    const a = generateMap(1234)
    const b = generateMap(1234)
    expect(Array.from(a)).toEqual(Array.from(b))
  })

  it('不同 seed 至少一格不同', () => {
    const a = generateMap(1)
    const b = generateMap(2)
    expect(Array.from(a)).not.toEqual(Array.from(b))
  })

  it('長度等於 GRID_W * GRID_H', () => {
    const map = generateMap(7)
    expect(map.length).toBe(GRID_W * GRID_H)
  })

  it('所有 (奇,奇) 格都是 TILE_WALL', () => {
    const map = generateMap(99)
    for (let cy = 0; cy < GRID_H; cy++) {
      for (let cx = 0; cx < GRID_W; cx++) {
        if (cx % 2 === 1 && cy % 2 === 1) {
          expect(map[cellIndex(cx, cy)]).toBe(TILE_WALL)
        }
      }
    }
  })

  it('多個 seed 下四個出生角落與其水平/垂直相鄰格都是 TILE_EMPTY', () => {
    const seeds = [0, 1, 2, 3, 7, 42, 99, 12345, 999999, 2 ** 31 - 1]
    for (const seed of seeds) {
      const map = generateMap(seed)
      for (const [cx, cy] of SPAWN_CORNERS) {
        const dx = cx === 0 ? 1 : -1
        const dy = cy === 0 ? 1 : -1
        expect(map[cellIndex(cx, cy)]).toBe(TILE_EMPTY)
        expect(map[cellIndex(cx + dx, cy)]).toBe(TILE_EMPTY)
        expect(map[cellIndex(cx, cy + dy)]).toBe(TILE_EMPTY)
      }
    }
  })

  it('只出現合法 tile 值（0/1/2/3）', () => {
    const map = generateMap(555)
    const legal = new Set([TILE_EMPTY, TILE_WALL, TILE_CRATE, TILE_CRATE_HARD])
    for (const tile of map) {
      expect(legal.has(tile)).toBe(true)
    }
  })
})

describe('cellIndex / inBounds / isBlocked', () => {
  it('cellIndex 依 cy*GRID_W+cx 計算', () => {
    expect(cellIndex(0, 0)).toBe(0)
    expect(cellIndex(1, 0)).toBe(1)
    expect(cellIndex(0, 1)).toBe(GRID_W)
    expect(cellIndex(GRID_W - 1, GRID_H - 1)).toBe(GRID_W * GRID_H - 1)
  })

  it('inBounds 對邊界內外正確判定', () => {
    expect(inBounds(0, 0)).toBe(true)
    expect(inBounds(GRID_W - 1, GRID_H - 1)).toBe(true)
    expect(inBounds(-1, 0)).toBe(false)
    expect(inBounds(0, -1)).toBe(false)
    expect(inBounds(GRID_W, 0)).toBe(false)
    expect(inBounds(0, GRID_H)).toBe(false)
  })

  it('isBlocked：場外視為阻擋', () => {
    const map = emptyMap()
    expect(isBlocked(map, -1, 0)).toBe(true)
    expect(isBlocked(map, GRID_W, 0)).toBe(true)
    expect(isBlocked(map, 0, GRID_H)).toBe(true)
  })

  it('isBlocked：牆與木箱視為阻擋，空格不阻擋', () => {
    const map = emptyMap()
    map[cellIndex(1, 1)] = TILE_WALL
    map[cellIndex(2, 2)] = TILE_CRATE
    map[cellIndex(3, 3)] = TILE_CRATE_HARD

    expect(isBlocked(map, 1, 1)).toBe(true)
    expect(isBlocked(map, 2, 2)).toBe(true)
    expect(isBlocked(map, 3, 3)).toBe(true)
    expect(isBlocked(map, 0, 0)).toBe(false)
  })
})

describe('blastCells', () => {
  it('空曠處：四方向都延伸滿 range，cells 含中心，長度 1 + 4*range', () => {
    const map = emptyMap()
    const range = 2
    const result = blastCells(map, 5, 5, range)

    expect(result.cells).toContainEqual([5, 5])
    expect(result.cells.length).toBe(1 + 4 * range)
    expect(result.destroyed).toEqual([])
    expect(result.damaged).toEqual([])
  })

  it('牆截斷：牆那格不進 cells，牆後不進', () => {
    const map = emptyMap()
    map[cellIndex(6, 5)] = TILE_WALL // 中心 (5,5) 右邊一格是牆
    const result = blastCells(map, 5, 5, 3)

    expect(result.cells).not.toContainEqual([6, 5])
    expect(result.cells).not.toContainEqual([7, 5])
    expect(result.cells).not.toContainEqual([8, 5])
  })

  it('軟箱：該格進 cells 與 destroyed，箱後截斷', () => {
    const map = emptyMap()
    map[cellIndex(6, 5)] = TILE_CRATE
    const result = blastCells(map, 5, 5, 3)

    expect(result.cells).toContainEqual([6, 5])
    expect(result.destroyed).toEqual([[6, 5]])
    expect(result.damaged).toEqual([])
    expect(result.cells).not.toContainEqual([7, 5])
  })

  it('硬箱：該格進 cells 與 damaged（不進 destroyed），箱後截斷', () => {
    const map = emptyMap()
    map[cellIndex(6, 5)] = TILE_CRATE_HARD
    const result = blastCells(map, 5, 5, 3)

    expect(result.cells).toContainEqual([6, 5])
    expect(result.damaged).toEqual([[6, 5]])
    expect(result.destroyed).toEqual([])
    expect(result.cells).not.toContainEqual([7, 5])
  })

  it('場外截斷：在角落引爆不會越界', () => {
    const map = emptyMap()
    const result = blastCells(map, 0, 0, 3)

    for (const [x, y] of result.cells) {
      expect(inBounds(x, y)).toBe(true)
    }
    // 左方/上方沒有格子可延伸，只剩中心 + 右方3格 + 下方3格
    expect(result.cells.length).toBe(1 + 3 + 3)
  })

  it('呼叫後傳入的 map 逐 byte 不變', () => {
    const map = emptyMap()
    map[cellIndex(6, 5)] = TILE_CRATE
    map[cellIndex(5, 6)] = TILE_CRATE_HARD
    map[cellIndex(4, 5)] = TILE_WALL
    const before = Array.from(map)

    blastCells(map, 5, 5, 3)

    expect(Array.from(map)).toEqual(before)
  })
})
