/**
 * 炸彈超人電腦玩家 AI（純邏輯，無 Babylon / scene 依賴，node 可直接單測）。
 *
 * 職責：由「地圖 + 現存炸彈/火焰 + 道具格 + 敵人格」算出危險時間圖，
 * 再為單隻 bot 決定本 tick 的動作——逃離 / 撿道具 / 放彈 / 走向攻擊位。
 * 只輸出「往哪一格移動」或「放彈」，實際位移、廣播與冷卻紀錄留在 bomber.ts 場景端。
 */
import {
  GRID_H,
  GRID_W,
  TILE_CRATE,
  TILE_CRATE_HARD,
  blastCells,
  cellIndex,
  inBounds,
  isBlocked,
} from './bomberMap'

// 電腦 AI 調校（皆為 host 端決策用的時間視窗，單位 ms）
/** 距引爆在此時間內的格視為「即將爆、絕不踏入」 */
export const AI_HOT_MS = 850
/** 站在會於此時間內爆的格就立刻開逃 */
export const AI_FLEE_MS = 1500
/** 逃離自放炸彈須預留的安全餘裕 */
export const AI_ESCAPE_MARGIN_MS = 280
/** 主動撿道具的最遠曼哈頓距離 */
export const AI_ITEM_MAX_DIST = 8

/** 危險圖用的炸彈快照（fire 為該炸彈擁有者的火力） */
export interface AiBomb {
  cx: number
  cy: number
  fire: number
  explodeAt: number
}

/** 危險圖用的火焰快照 */
export interface AiFlame {
  cx: number
  cy: number
  until: number
}

/** 與場景共用的數值；由 bomber.ts 傳入，避免 AI 模組反向相依場景常數 */
export interface AiTuning {
  /** 一格的世界座標邊長（CELL） */
  cellSize: number
  /** 炸彈引信長度（BOMB_FUSE_MS） */
  fuseMs: number
  /** 火焰殘留時間（FLAME_MS） */
  flameMs: number
}

/** 單隻 bot 本 tick 的決策：待命 / 移向某格 / 在原地放彈 */
export type BotAction =
  | { type: 'idle' }
  | { type: 'move'; cx: number; cy: number }
  | { type: 'bomb' }

/**
 * 危險時間圖：每格 → 最早會致命的時刻（與 now 同一時鐘的毫秒）。未列入者代表目前安全。
 * - 現存火焰：當下即致命（now）。
 * - 炸彈：以各自引信時刻標記整條爆風；並模擬「連鎖」——某炸彈爆風覆蓋另一炸彈所在格時，
 *   被覆蓋者的有效引爆時刻提前為觸發者的時刻（迭代到收斂）。
 * 有了時間維度，bot 才能分辨「剛放下、還很久才爆」與「即將引爆」的格，不再過度膽小。
 */
export const computeDangerMap = (
  map: Uint8Array,
  bombs: AiBomb[],
  flames: AiFlame[],
  now: number,
): Map<number, number> => {
  const dmap = new Map<number, number>()
  const setMin = (ci: number, t: number) => {
    const cur = dmap.get(ci)
    if (cur === undefined || t < cur) dmap.set(ci, t)
  }
  for (const f of flames) if (f.until > now) setMin(cellIndex(f.cx, f.cy), now)

  const arr = bombs
  const eff = arr.map((b) => b.explodeAt)
  const blasts = arr.map((b) =>
    blastCells(map, b.cx, b.cy, b.fire).cells.map(([x, y]) => cellIndex(x, y)),
  )
  // 連鎖傳遞：最多迭代 N 輪（N = 炸彈數）即收斂
  for (let iter = 0; iter < arr.length; iter++) {
    let changed = false
    for (let i = 0; i < arr.length; i++) {
      for (let j = 0; j < arr.length; j++) {
        if (i === j) continue
        if (blasts[i].includes(cellIndex(arr[j].cx, arr[j].cy)) && eff[i] < eff[j]) {
          eff[j] = eff[i]
          changed = true
        }
      }
    }
    if (!changed) break
  }
  for (let i = 0; i < arr.length; i++) for (const ci of blasts[i]) setMin(ci, eff[i])
  return dmap
}

/** 某格是否可踏入（空地、非阻擋、無炸彈） */
export const cellWalkable = (map: Uint8Array, bombs: AiBomb[], cx: number, cy: number): boolean => {
  if (isBlocked(map, cx, cy)) return false
  for (const b of bombs) if (b.cx === cx && b.cy === cy) return false
  return true
}

/**
 * 格圖 BFS：從 (sx,sy) 找到最近滿足 goalFn 的格，回傳第一步鄰格與步數距離。
 * blockedFn 為真的格不可踏入（也不能當終點）。起點滿足 goalFn 或無路徑皆回 null。
 * grid 13×11，每幀每隻 bot 跑成本極低。
 */
export const bfsToGoal = (
  map: Uint8Array,
  bombs: AiBomb[],
  sx: number,
  sy: number,
  goalFn: (cx: number, cy: number) => boolean,
  blockedFn: (cx: number, cy: number) => boolean,
): { first: [number, number]; dist: number } | null => {
  if (goalFn(sx, sy)) return null
  const dirs: [number, number][] = [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
  ]
  const visited = new Set<number>([cellIndex(sx, sy)])
  const queue: { x: number; y: number; first: [number, number] | null; dist: number }[] = [
    { x: sx, y: sy, first: null, dist: 0 },
  ]
  let head = 0
  while (head < queue.length) {
    const cur = queue[head++]
    for (const [dx, dy] of dirs) {
      const nx = cur.x + dx
      const ny = cur.y + dy
      if (!inBounds(nx, ny)) continue
      const ci = cellIndex(nx, ny)
      if (visited.has(ci)) continue
      if (!cellWalkable(map, bombs, nx, ny) || blockedFn(nx, ny)) continue
      visited.add(ci)
      const first: [number, number] = cur.first ?? [nx, ny]
      const dist = cur.dist + 1
      if (goalFn(nx, ny)) return { first, dist }
      queue.push({ x: nx, y: ny, first, dist })
    }
  }
  return null
}

/**
 * bot 在 (cx,cy) 放彈後是否還來得及逃到安全格。
 * 把「假想新炸彈」（引信 = now + fuse）疊上目前危險圖，BFS 找一個放彈後仍安全、
 * 且在引信時間內（依移速換算步數）能抵達的格。比只看兩步拓樸更可靠，避免自殺。
 */
export const canEscapeAfterBomb = (
  map: Uint8Array,
  bombs: AiBomb[],
  cx: number,
  cy: number,
  fire: number,
  dmap: Map<number, number>,
  now: number,
  speed: number,
  tuning: AiTuning,
): boolean => {
  const detonate = now + tuning.fuseMs
  const blast = new Set(blastCells(map, cx, cy, fire).cells.map(([x, y]) => cellIndex(x, y)))
  const dAt = (gx: number, gy: number): number => {
    const ci = cellIndex(gx, gy)
    let t = dmap.get(ci) ?? Infinity
    if (blast.has(ci)) t = Math.min(t, detonate)
    return t
  }
  const timePerCell = (tuning.cellSize / speed) * 1000
  const maxSteps = Math.floor((tuning.fuseMs - AI_ESCAPE_MARGIN_MS) / timePerCell)
  if (maxSteps < 1) return false
  const res = bfsToGoal(
    map,
    bombs,
    cx,
    cy,
    // 終點：放彈後不會被波及（含火焰殘留時間）
    (gx, gy) => dAt(gx, gy) > detonate + tuning.flameMs,
    // 不穿越即將爆炸的格
    (gx, gy) => dAt(gx, gy) - now <= AI_HOT_MS,
  )
  return !!res && res.dist <= maxSteps
}

/** 每隻 bot 的固定性格（依 id 雜湊），讓三隻電腦行為分歧、不擠成一團 */
export const botAggro = (id: string): number => {
  let h = 0
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0
  return 0.35 + (h % 100) / 100 / 1.6 // 0.35 ~ 0.97
}

/** decideBotAction 的輸入快照（皆為當下狀態的純資料） */
export interface BotDecisionInput {
  map: Uint8Array
  /** 場上現存炸彈（含本 tick 稍早由其他 bot 放下的） */
  bombs: AiBomb[]
  /** computeDangerMap 的結果（同一 tick 內共用） */
  danger: Map<number, number>
  now: number
  /** bot 目前所在格 */
  cx: number
  cy: number
  /** bot 目前移速（世界單位／秒） */
  speed: number
  /** bot 火力（爆炸延伸格數） */
  fire: number
  /** bot 性格（botAggro） */
  aggro: number
  /** 場上道具所在的 cellIndex 集合 */
  itemCells: Set<number>
  /** 其他存活實體所在格 */
  enemyCells: [number, number][]
  /** 放彈冷卻是否已過 */
  bombReady: boolean
  tuning: AiTuning
}

/** 單隻 bot 的決策：時間感知避險 → 撿道具 → 攻擊放彈 → 走向攻擊位 → 粗略趨近 */
export const decideBotAction = (input: BotDecisionInput): BotAction => {
  const { map, bombs, danger, now, cx, cy, speed, fire, aggro, itemCells, enemyCells, bombReady, tuning } =
    input
  const dirs: [number, number][] = [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
  ]
  const dAt = (ci: number): number => danger.get(ci) ?? Infinity
  const flamingNow = (gx: number, gy: number): boolean => dAt(cellIndex(gx, gy)) <= now
  const hotSoon = (gx: number, gy: number): boolean => dAt(cellIndex(gx, gy)) - now <= AI_HOT_MS
  const safeToStand = (gx: number, gy: number): boolean => {
    const t = dAt(cellIndex(gx, gy))
    return t === Infinity || t - now > AI_FLEE_MS
  }
  const bfs = (
    goalFn: (gx: number, gy: number) => boolean,
    blockedFn: (gx: number, gy: number) => boolean,
  ) => bfsToGoal(map, bombs, cx, cy, goalFn, blockedFn)

  // (a) 避險：站在會於 AI_FLEE_MS 內爆的格 → BFS 找最近安全格逃離（只避開當下火焰）。
  const myDanger = dAt(cellIndex(cx, cy)) - now
  if (myDanger <= AI_FLEE_MS) {
    const res = bfs(safeToStand, flamingNow)
    if (res) return { type: 'move', cx: res.first[0], cy: res.first[1] }
    // 退路全被堵：朝「最晚才爆」的可走鄰格拖延
    let best: [number, number] | null = null
    let bestT = -Infinity
    for (const [dx, dy] of dirs) {
      const nx = cx + dx
      const ny = cy + dy
      if (!cellWalkable(map, bombs, nx, ny) || flamingNow(nx, ny)) continue
      const t = dAt(cellIndex(nx, ny))
      if (t > bestT) {
        bestT = t
        best = [nx, ny]
      }
    }
    return best ? { type: 'move', cx: best[0], cy: best[1] } : { type: 'idle' }
  }

  // (b) 撿道具：BFS（避開即將爆的格）走向最近道具，撿取/套用交給場景端的 detectPickups。
  if (itemCells.size > 0) {
    const res = bfs(
      (gx, gy) =>
        itemCells.has(cellIndex(gx, gy)) && Math.abs(gx - cx) + Math.abs(gy - cy) <= AI_ITEM_MAX_DIST,
      hotSoon,
    )
    if (res) return { type: 'move', cx: res.first[0], cy: res.first[1] }
  }

  // (c) 攻擊/開路。
  // 放彈判定：以「實際爆風」(blastCells，會被箱子擋住) 判斷能否打到敵人；或相鄰箱子。
  const myBlast = new Set(blastCells(map, cx, cy, fire).cells.map(([x, y]) => cellIndex(x, y)))
  const hitsEnemy = enemyCells.some(([ecx, ecy]) => myBlast.has(cellIndex(ecx, ecy)))
  // 越界鄰格不算箱子（cellIndex 不檢查邊界，右/下邊界會折到鄰列）
  let adjacentCrate = false
  for (const [dx, dy] of dirs) {
    if (!inBounds(cx + dx, cy + dy)) continue
    const t = map[cellIndex(cx + dx, cy + dy)]
    if (t === TILE_CRATE || t === TILE_CRATE_HARD) adjacentCrate = true
  }
  if (
    (adjacentCrate || hitsEnemy) &&
    bombReady &&
    canEscapeAfterBomb(map, bombs, cx, cy, fire, danger, now, speed, tuning)
  ) {
    return { type: 'bomb' } // 下一 tick 新炸彈進入危險圖，以 (a) 逃離
  }

  // 攻擊位：正交相鄰箱子，或站該格放彈其實際爆風能打到敵人。
  // 性格 aggro 高者更傾向追敵；低者偏好炸箱farm。
  const isAttackSpot = (gx: number, gy: number): boolean => {
    if (enemyCells.length > 0 && aggro > 0.5) {
      const spotBlast = new Set(blastCells(map, gx, gy, fire).cells.map(([x, y]) => cellIndex(x, y)))
      if (enemyCells.some(([ecx, ecy]) => spotBlast.has(cellIndex(ecx, ecy)))) return true
    }
    for (const [dx, dy] of dirs) {
      if (!inBounds(gx + dx, gy + dy)) continue
      const t = map[cellIndex(gx + dx, gy + dy)]
      if (t === TILE_CRATE || t === TILE_CRATE_HARD) return true
    }
    return false
  }

  const res = bfs((gx, gy) => isAttackSpot(gx, gy), hotSoon)
  if (res) return { type: 'move', cx: res.first[0], cy: res.first[1] }

  // 找不到攻擊位（多被危險封住）：朝最近箱子/敵人方向、避開即將爆的格走一步
  let target: [number, number] | null = null
  let bestDist = Infinity
  const consider = (tx: number, ty: number) => {
    const d = Math.abs(tx - cx) + Math.abs(ty - cy)
    if (d < bestDist) {
      bestDist = d
      target = [tx, ty]
    }
  }
  for (let gy = 0; gy < GRID_H; gy++) {
    for (let gx = 0; gx < GRID_W; gx++) {
      const t = map[cellIndex(gx, gy)]
      if (t === TILE_CRATE || t === TILE_CRATE_HARD) consider(gx, gy)
    }
  }
  for (const [ecx, ecy] of enemyCells) consider(ecx, ecy)
  if (target) {
    const [tx, ty] = target as [number, number]
    const sx = Math.sign(tx - cx)
    const sy = Math.sign(ty - cy)
    const tryAxes: [number, number][] =
      Math.abs(tx - cx) >= Math.abs(ty - cy) ? [[sx, 0], [0, sy]] : [[0, sy], [sx, 0]]
    for (const [dx, dy] of tryAxes) {
      if (dx === 0 && dy === 0) continue
      const nx = cx + dx
      const ny = cy + dy
      if (cellWalkable(map, bombs, nx, ny) && !hotSoon(nx, ny)) {
        return { type: 'move', cx: nx, cy: ny }
      }
    }
  }
  return { type: 'idle' }
}
