import { describe, it, expect } from 'vitest'
import {
  botAggro,
  canEscapeAfterBomb,
  computeDangerMap,
  decideBotAction,
  type AiBomb,
  type AiTuning,
} from './bomberAI'
import { GRID_H, GRID_W, TILE_CRATE, TILE_WALL, cellIndex } from './bomberMap'

/**
 * bomber AI 純邏輯測試：危險時間圖（含連鎖）與單隻 bot 的決策分支。
 * 一律用全空地圖手動擺障礙，避免依賴 generateMap 的隨機分佈。
 */

/** 全空地圖（無牆無箱），依需要再手動填格 */
const emptyMap = (): Uint8Array => new Uint8Array(GRID_W * GRID_H)

/** 與 bomber.ts 場景常數對齊（CELL / BOMB_FUSE_MS / FLAME_MS） */
const TUNING: AiTuning = { cellSize: 2, fuseMs: 2000, flameMs: 550 }

const NOW = 100_000
const SPEED = 5.5

const baseInput = (over: Partial<Parameters<typeof decideBotAction>[0]> = {}) => ({
  map: emptyMap(),
  bombs: [] as AiBomb[],
  danger: new Map<number, number>(),
  now: NOW,
  cx: 0,
  cy: 0,
  speed: SPEED,
  fire: 1,
  aggro: 0.5,
  itemCells: new Set<number>(),
  enemyCells: [] as [number, number][],
  bombReady: true,
  tuning: TUNING,
  ...over,
})

describe('computeDangerMap', () => {
  it('炸彈爆風各格標上該炸彈的引爆時刻，範圍外不列入', () => {
    const map = emptyMap()
    const bombs: AiBomb[] = [{ cx: 0, cy: 0, fire: 1, explodeAt: NOW + 1000 }]

    const d = computeDangerMap(map, bombs, [], NOW)

    expect(d.get(cellIndex(0, 0))).toBe(NOW + 1000)
    expect(d.get(cellIndex(1, 0))).toBe(NOW + 1000)
    expect(d.get(cellIndex(0, 1))).toBe(NOW + 1000)
    expect(d.get(cellIndex(2, 0))).toBeUndefined() // fire=1，延伸不到
  })

  it('連鎖：被早爆炸彈覆蓋的炸彈，其爆風提前為觸發者的時刻', () => {
    const map = emptyMap()
    const bombs: AiBomb[] = [
      { cx: 0, cy: 0, fire: 1, explodeAt: NOW + 500 }, // 爆風覆蓋 (1,0)
      { cx: 1, cy: 0, fire: 1, explodeAt: NOW + 9000 }, // 原本很晚才爆
    ]

    const d = computeDangerMap(map, bombs, [], NOW)

    expect(d.get(cellIndex(2, 0))).toBe(NOW + 500) // 第二顆的爆風也被提前
  })

  it('現存火焰當下即致命，已到期的火焰忽略', () => {
    const d = computeDangerMap(emptyMap(), [], [
      { cx: 5, cy: 5, until: NOW + 200 },
      { cx: 6, cy: 5, until: NOW - 1 },
    ], NOW)

    expect(d.get(cellIndex(5, 5))).toBe(NOW)
    expect(d.get(cellIndex(6, 5))).toBeUndefined()
  })
})

describe('canEscapeAfterBomb', () => {
  it('有空曠退路時判定逃得掉', () => {
    expect(
      canEscapeAfterBomb(emptyMap(), [], 0, 0, 1, new Map(), NOW, SPEED, TUNING)
    ).toBe(true)
  })

  it('四周被牆封死時判定逃不掉（不自殺）', () => {
    const map = emptyMap()
    map[cellIndex(1, 0)] = TILE_WALL
    map[cellIndex(0, 1)] = TILE_WALL

    expect(canEscapeAfterBomb(map, [], 0, 0, 1, new Map(), NOW, SPEED, TUNING)).toBe(false)
  })
})

describe('decideBotAction', () => {
  it('(a) 站在即將爆的格 → 往安全格逃', () => {
    const bombs: AiBomb[] = [{ cx: 0, cy: 0, fire: 1, explodeAt: NOW + 100 }]
    const danger = computeDangerMap(emptyMap(), bombs, [], NOW)

    const action = decideBotAction(baseInput({ bombs, danger }))

    expect(action).toEqual({ type: 'move', cx: 1, cy: 0 })
  })

  it('(b) 無危險且場上有道具 → 走向最近道具', () => {
    const action = decideBotAction(baseInput({ itemCells: new Set([cellIndex(3, 0)]) }))

    expect(action).toEqual({ type: 'move', cx: 1, cy: 0 })
  })

  it('(c) 相鄰木箱、冷卻已過且逃得掉 → 放彈', () => {
    const map = emptyMap()
    map[cellIndex(1, 0)] = TILE_CRATE

    expect(decideBotAction(baseInput({ map }))).toEqual({ type: 'bomb' })
  })

  it('(c) 冷卻未過就不放彈，改走向攻擊位', () => {
    const map = emptyMap()
    map[cellIndex(1, 0)] = TILE_CRATE

    const action = decideBotAction(baseInput({ map, bombReady: false }))

    expect(action.type).not.toBe('bomb')
  })

  it('內部格：右側鄰格有箱子就放彈（邊界修正的正向對照）', () => {
    const map = emptyMap()
    map[cellIndex(5, 5)] = TILE_CRATE

    expect(decideBotAction(baseInput({ map, cx: 4, cy: 5 }))).toEqual({ type: 'bomb' })
  })

  it('右邊界：鄰列的箱子不算相鄰（cellIndex 會折到下一列）', () => {
    const map = emptyMap()
    // (0,6) 的線性索引 = cellIndex(GRID_W-1, 5) + 1，未做邊界檢查就會被誤讀成右鄰格
    map[cellIndex(0, 6)] = TILE_CRATE

    expect(decideBotAction(baseInput({ map, cx: GRID_W - 1, cy: 5 }))).not.toEqual({ type: 'bomb' })
  })

  it('下邊界：越界的下鄰格不算相鄰', () => {
    const map = emptyMap()
    // cellIndex(3, GRID_H) 已越出陣列，未檢查邊界時讀到 undefined；
    // 這裡確認最下排、四周皆空時不會誤判成有箱子可炸
    expect(
      decideBotAction(baseInput({ map, cx: 3, cy: GRID_H - 1 }))
    ).toEqual({ type: 'idle' })
  })

  it('攻擊位判定同樣不把鄰列的箱子當成右鄰格', () => {
    const map = emptyMap()
    map[cellIndex(0, 6)] = TILE_CRATE // 線性索引恰好接在 (GRID_W-1, 5) 之後

    // bot 就在 (GRID_W-1, 5) 隔壁：未做邊界檢查時該格會被誤判為攻擊位而被選為目標
    const action = decideBotAction(baseInput({ map, cx: GRID_W - 2, cy: 5 }))

    expect(action).not.toEqual({ type: 'move', cx: GRID_W - 1, cy: 5 })
  })

  it('空地圖、無敵人、無道具、無箱子時待命', () => {
    expect(decideBotAction(baseInput())).toEqual({ type: 'idle' })
  })

  it('回傳的移動目標一定在盤面內', () => {
    const map = emptyMap()
    map[cellIndex(1, 0)] = TILE_CRATE
    const action = decideBotAction(baseInput({ map, bombReady: false, cx: 0, cy: 0 }))
    if (action.type === 'move') {
      expect(action.cx).toBeGreaterThanOrEqual(0)
      expect(action.cx).toBeLessThan(GRID_W)
      expect(action.cy).toBeGreaterThanOrEqual(0)
      expect(action.cy).toBeLessThan(GRID_H)
    }
  })
})

describe('botAggro', () => {
  it('同 id 恆定、落在 0.35~0.97', () => {
    expect(botAggro('bot-0')).toBe(botAggro('bot-0'))
    for (const id of ['bot-0', 'bot-1', 'bot-2', 'bot-3']) {
      expect(botAggro(id)).toBeGreaterThanOrEqual(0.35)
      expect(botAggro(id)).toBeLessThanOrEqual(0.97)
    }
  })
})
