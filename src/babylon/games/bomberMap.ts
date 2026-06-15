/**
 * 炸彈超人地圖與爆炸純邏輯（無引擎依賴，node 可直接單測）。
 *
 * 地圖：13×11 格。柱牆固定在 (奇,奇) 格；其餘格依 seed 決定性灑木箱，
 * 四個出生角落（角 + 相鄰兩格）保持淨空。場外視為牆（邊界由越界判定承擔）。
 * 爆炸：十字向四方延伸 range 格——牆截斷、木箱炸毀該箱後截斷、空格續延。
 */

export const GRID_W = 13
export const GRID_H = 11

export const TILE_EMPTY = 0
export const TILE_WALL = 1
export const TILE_CRATE = 2
/** 硬箱：要炸兩次（第一次降級為 TILE_CRATE，第二次才炸毀） */
export const TILE_CRATE_HARD = 3

/** 四個出生角（依玩家序分配） */
export const SPAWN_CORNERS: ReadonlyArray<readonly [number, number]> = [
  [0, 0],
  [GRID_W - 1, GRID_H - 1],
  [GRID_W - 1, 0],
  [0, GRID_H - 1],
]

export const cellIndex = (cx: number, cy: number): number => cy * GRID_W + cx

export const inBounds = (cx: number, cy: number): boolean =>
  cx >= 0 && cx < GRID_W && cy >= 0 && cy < GRID_H

/** 牆/木箱/場外皆視為阻擋 */
export const isBlocked = (map: Uint8Array, cx: number, cy: number): boolean =>
  !inBounds(cx, cy) || map[cellIndex(cx, cy)] !== TILE_EMPTY

/** mulberry32 決定性 PRNG（同 seed 同序列，各端生成相同地圖） */
export const mulberry32 = (seed: number): (() => number) => {
  let s = seed >>> 0
  return () => {
    s = (s + 0x6d2b79f5) >>> 0
    let t = s
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const CRATE_PROBABILITY = 0.55
/** 木箱中為硬箱（要炸兩次）的比例 */
const HARD_CRATE_RATIO = 0.28

/** 出生角淨空區：角落格 + 水平/垂直相鄰各一格 */
const spawnClearZone = (): Set<number> => {
  const zone = new Set<number>()
  for (const [cx, cy] of SPAWN_CORNERS) {
    zone.add(cellIndex(cx, cy))
    const dx = cx === 0 ? 1 : -1
    const dy = cy === 0 ? 1 : -1
    zone.add(cellIndex(cx + dx, cy))
    zone.add(cellIndex(cx, cy + dy))
  }
  return zone
}

export const generateMap = (seed: number): Uint8Array => {
  const map = new Uint8Array(GRID_W * GRID_H)
  const rand = mulberry32(seed)
  const clear = spawnClearZone()
  for (let cy = 0; cy < GRID_H; cy++) {
    for (let cx = 0; cx < GRID_W; cx++) {
      const i = cellIndex(cx, cy)
      if (cx % 2 === 1 && cy % 2 === 1) {
        map[i] = TILE_WALL
      } else if (!clear.has(i) && rand() < CRATE_PROBABILITY) {
        // 同一條 rand 序列再抽一次決定軟/硬箱，各端決定性一致
        map[i] = rand() < HARD_CRATE_RATIO ? TILE_CRATE_HARD : TILE_CRATE
      }
    }
  }
  return map
}

export interface BlastResult {
  /** 火焰覆蓋格（含中心；含被炸毀的木箱格） */
  cells: Array<readonly [number, number]>
  /** 被完全炸毀的軟箱格（會清除並掉道具） */
  destroyed: Array<readonly [number, number]>
  /** 被擊中但只降級的硬箱格（硬箱 → 軟箱，不掉道具） */
  damaged: Array<readonly [number, number]>
}

/** 計算爆炸範圍（不修改 map；炸毀木箱由呼叫端依 destroyed 套用） */
export const blastCells = (
  map: Uint8Array,
  cx: number,
  cy: number,
  range: number
): BlastResult => {
  const cells: Array<readonly [number, number]> = [[cx, cy]]
  const destroyed: Array<readonly [number, number]> = []
  const damaged: Array<readonly [number, number]> = []
  for (const [dx, dy] of [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
  ]) {
    for (let i = 1; i <= range; i++) {
      const x = cx + dx * i
      const y = cy + dy * i
      if (!inBounds(x, y)) break
      const tile = map[cellIndex(x, y)]
      if (tile === TILE_WALL) break
      cells.push([x, y])
      // 軟箱：炸毀並截斷；硬箱：只降級並截斷
      if (tile === TILE_CRATE) {
        destroyed.push([x, y])
        break
      }
      if (tile === TILE_CRATE_HARD) {
        damaged.push([x, y])
        break
      }
    }
  }
  return { cells, destroyed, damaged }
}
