/**
 * 賽車賽道與名次（純函式，不依賴 Babylon，可在 node 單測）。
 *
 * 座標慣例同 race.ts：俯視 x、z 平面，朝向 ry 的前方 = (sin ry, cos ry)，
 * 右側 = (cos ry, −sin ry)；lateral 以行進方向看右正左負。
 */

export type Vec2 = [number, number]

export interface Track {
  /** 閉合折線取樣點（首點不在尾端重複），段 i 為 pts[i] → pts[(i+1) % N] */
  pts: Vec2[]
  /** 總長 */
  len: number
  /** 路寬（中心線兩側各 width / 2） */
  width: number
  /** CHECKPOINTS 個檢查點的沿線距離，0 號 = 起點線（s = 0），升冪 */
  checkpoints: number[]
  /** 附加：pts[i] 的沿線距離（cum[0] = 0） */
  cum: number[]
}

export interface Progress {
  s: number
  lateral: number
  seg: number
}

export interface LapState {
  /** 已完成圈數 0..LAPS */
  lap: number
  /** 最後一個依序通過的檢查點 0..CHECKPOINTS−1 */
  cp: number
}

export const CHECKPOINTS = 8
export const LAPS = 3
export const WRONG_WAY_MS = 1500
/** 車頭與賽道切線夾角超過此值算逆行（rad，約 100°） */
export const WRONG_WAY_ANGLE = (100 * Math.PI) / 180
/** 低於此速度不累計逆向（原地打轉不跳警告） */
export const WRONG_WAY_MIN_SPEED = 1
/** 第一台過線後其他車可繼續衝線的時間 */
export const FINISH_GRACE_MS = 15000
/** Catmull-Rom 每段取樣點數（spec §1.1：16 點，賽道 s 值都以此量出） */
export const SAMPLES_PER_SEG = 16
/** 曲率視窗：s ± 3（spec §1.2） */
export const CURVE_WINDOW = 6

const TAU = Math.PI * 2

/** 角度差環繞到 (−π, π] */
export const wrapAngle = (a: number): number => {
  const r = a - TAU * Math.floor((a + Math.PI) / TAU)
  return r === -Math.PI ? Math.PI : r
}

const wrapS = (t: Track, s: number): number => ((s % t.len) + t.len) % t.len

const catmull = (p0: number, p1: number, p2: number, p3: number, u: number): number =>
  0.5 * (2 * p1 + (p2 - p0) * u + (2 * p0 - 5 * p1 + 4 * p2 - p3) * u * u + (3 * p1 - p0 - 3 * p2 + p3) * u * u * u)

/** 閉合控制點 → uniform Catmull-Rom 每段 SAMPLES_PER_SEG 點的折線；檢查點沿線均分，0 號在 ctrl[0]（起點線） */
export function makeTrack(ctrl: Vec2[], width: number): Track {
  const n = ctrl.length
  const pts: Vec2[] = []
  for (let i = 0; i < n; i++) {
    const p0 = ctrl[(i - 1 + n) % n]
    const p1 = ctrl[i]
    const p2 = ctrl[(i + 1) % n]
    const p3 = ctrl[(i + 2) % n]
    for (let j = 0; j < SAMPLES_PER_SEG; j++) {
      const u = j / SAMPLES_PER_SEG
      pts.push([catmull(p0[0], p1[0], p2[0], p3[0], u), catmull(p0[1], p1[1], p2[1], p3[1], u)])
    }
  }
  const cum: number[] = [0]
  let len = 0
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i]
    const b = pts[(i + 1) % pts.length]
    len += Math.hypot(b[0] - a[0], b[1] - a[1])
    if (i + 1 < pts.length) cum.push(len)
  }
  const checkpoints = Array.from({ length: CHECKPOINTS }, (_, i) => (len * i) / CHECKPOINTS)
  return { pts, len, width, checkpoints, cum }
}

/** 最近折線段的投影：沿線距離 s ∈ [0, len)、有號橫向距離、段號 */
export function trackProgress(t: Track, x: number, z: number): Progress {
  const n = t.pts.length
  let best = Infinity
  let seg = 0
  let bestU = 0
  for (let i = 0; i < n; i++) {
    const a = t.pts[i]
    const b = t.pts[(i + 1) % n]
    const dx = b[0] - a[0]
    const dz = b[1] - a[1]
    const l2 = dx * dx + dz * dz
    const u = l2 > 0 ? Math.max(0, Math.min(1, ((x - a[0]) * dx + (z - a[1]) * dz) / l2)) : 0
    const px = a[0] + dx * u - x
    const pz = a[1] + dz * u - z
    const d2 = px * px + pz * pz
    if (d2 < best) {
      best = d2
      seg = i
      bestU = u
    }
  }
  const a = t.pts[seg]
  const b = t.pts[(seg + 1) % n]
  const dx = b[0] - a[0]
  const dz = b[1] - a[1]
  const l = Math.hypot(dx, dz)
  const ox = x - (a[0] + dx * bestU)
  const oz = z - (a[1] + dz * bestU)
  const side = l > 0 ? (ox * dz - oz * dx) / l : 0
  const lateral = Math.sign(side) * Math.sqrt(best)
  return { s: wrapS(t, t.cum[seg] + bestU * l), lateral, seg }
}

/** 沿線距離 s（可超出一圈或為負，會環繞）→ 中心線座標與朝向 ry */
export function pointAt(t: Track, s: number): { x: number; z: number; heading: number } {
  const w = wrapS(t, s)
  let lo = 0
  let hi = t.cum.length - 1
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1
    if (t.cum[mid] <= w) lo = mid
    else hi = mid - 1
  }
  const a = t.pts[lo]
  const b = t.pts[(lo + 1) % t.pts.length]
  const segEnd = lo + 1 < t.cum.length ? t.cum[lo + 1] : t.len
  const l = segEnd - t.cum[lo]
  const u = l > 0 ? (w - t.cum[lo]) / l : 0
  return {
    x: a[0] + (b[0] - a[0]) * u,
    z: a[1] + (b[1] - a[1]) * u,
    heading: Math.atan2(b[0] - a[0], b[1] - a[1]),
  }
}

/** s 所在的檢查點區：不大於 s 的最後一個檢查點序號 */
export function sectorOf(t: Track, s: number): number {
  const w = wrapS(t, s)
  let k = 0
  for (let i = 1; i < t.checkpoints.length; i++) if (t.checkpoints[i] <= w) k = i
  return k
}

/** 進到檢查點區 sector：只有「下一個」檢查點會前進，回到 0 號才加圈；跑滿 LAPS 後不變 */
export function advanceLap(prev: LapState, sector: number): LapState {
  if (prev.lap >= LAPS) return prev
  const next = (prev.cp + 1) % CHECKPOINTS
  if (sector !== next) return prev
  return next === 0 ? { lap: prev.lap + 1, cp: 0 } : { lap: prev.lap, cp: next }
}

/**
 * 名次用的 (lap, s)：以「最後通過的檢查點」為錨修正原始 s。
 * 連續行駛只可能在本區（往前 ≤ gap）或檢查點後方（倒車，距離不限）。
 * - 本區內 → 原樣
 * - 落在下一個檢查點區（cp 尚未推進）或下下個區（跳過一個檢查點的捷徑、路外投影跳段）→ s 夾在下一個未通過的檢查點
 * - 其餘 → 倒車：從最後通過的檢查點往回算，越過起點線就算回上一圈；lap 0 時夾成 s = 0（起跑格）
 *   （8 個檢查點時，倒車超過約 5/8 圈才進到這裡；再少就與跳過一個檢查點無法區分）
 * 各 client 對同一份快照算出相同結果；rankCars 前先套這個。
 */
export function normalizeProgress(t: Track, c: { lap: number; cp: number; s: number }): { lap: number; s: number } {
  const cpS = t.checkpoints[c.cp] ?? 0
  const nextCp = (c.cp + 1) % CHECKPOINTS
  const ahead = (k: number) => wrapS(t, (t.checkpoints[k] ?? 0) - cpS) || t.len
  const gap = ahead(nextCp)
  const fwd = wrapS(t, c.s - cpS)
  if (fwd > gap && fwd <= ahead((c.cp + 3) % CHECKPOINTS)) {
    return nextCp === 0 ? { lap: c.lap + 1, s: 0 } : { lap: c.lap, s: t.checkpoints[nextCp] }
  }
  const at = cpS + (fwd <= gap ? fwd : fwd - t.len)
  const lap = c.lap + (at >= t.len ? 1 : at < 0 ? -1 : 0)
  if (lap < 0) return { lap: 0, s: 0 }
  return { lap, s: c.s }
}

/** 逆向累計：車的行進方向與賽道切線夾角 > WRONG_WAY_ANGLE 且在動才累計，否則歸零 */
export function stepWrongWay(
  ms: number,
  input: { heading: number; trackHeading: number; speed: number },
  dtMs: number
): { ms: number; wrongWay: boolean } {
  const moving = Math.abs(input.speed) > WRONG_WAY_MIN_SPEED
  const dir = input.speed < 0 ? input.heading + Math.PI : input.heading
  const against = Math.abs(wrapAngle(dir - input.trackHeading)) > WRONG_WAY_ANGLE
  const next = moving && against ? ms + dtMs : 0
  return { ms: next, wrongWay: next >= WRONG_WAY_MS }
}

export interface RankEntry {
  id: string
  lap: number
  s: number
  finishedAt: number | null
}

/** 已過線依 finishedAt 升冪；未過線依 lap、s 降冪；同分依 id 字典序。不改動輸入 */
export function rankCars(list: readonly RankEntry[]): string[] {
  const byId = (a: RankEntry, b: RankEntry) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)
  return [...list]
    .sort((a, b) => {
      if (a.finishedAt !== null && b.finishedAt !== null) return a.finishedAt - b.finishedAt || byId(a, b)
      if (a.finishedAt !== null) return -1
      if (b.finishedAt !== null) return 1
      return b.lap - a.lap || b.s - a.s || byId(a, b)
    })
    .map((c) => c.id)
}

/** s 是否落在 [s0, s1)（跨起點時 s1 可大於 len，或 s0 為負） */
export function inSpan(t: Track, s: number, span: readonly [number, number]): boolean {
  const w = wrapS(t, s)
  return [w - t.len, w, w + t.len].some((v) => v >= span[0] && v < span[1])
}

/** 視窗曲率（rad / 單位），正 = 右彎 */
export function curvatureAt(t: Track, s: number, window = CURVE_WINDOW): number {
  const a = pointAt(t, s - window / 2).heading
  const b = pointAt(t, s + window / 2).heading
  return wrapAngle(b - a) / window
}

/**
 * 可甩尾的長彎：|曲率| ≥ kMin、同一轉向、連續長度 ≥ minLen 的區段。
 * 回傳 [s0, s1)，s0 ∈ [0, len)，跨起點時 s1 > len；整圈同向回 [[0, len]]。
 */
export function findLongCurves(t: Track, kMin: number, minLen: number): [number, number][] {
  const n = t.pts.length
  const mark = t.cum.map((s) => {
    const k = curvatureAt(t, s)
    return k >= kMin ? 1 : k <= -kMin ? -1 : 0
  })
  let start = -1
  for (let i = 0; i < n; i++) {
    if (mark[i] !== mark[(i - 1 + n) % n]) {
      start = i
      break
    }
  }
  if (start < 0) return mark[0] !== 0 && t.len >= minLen ? [[0, t.len]] : []
  const out: [number, number][] = []
  let i = 0
  while (i < n) {
    const idx = (start + i) % n
    const m = mark[idx]
    let j = i
    while (j < n && mark[(start + j) % n] === m) j++
    if (m !== 0) {
      const s0 = t.cum[idx]
      const endIdx = (start + j) % n
      const length = (t.cum[endIdx] - s0 + t.len) % t.len || t.len
      if (length >= minLen) out.push([s0, s0 + length])
    }
    i = j
  }
  return out.sort((a, b) => a[0] - b[0])
}

/** 中心線 s 處往右偏 lateral 的世界座標與該處朝向 */
export function placeAt(t: Track, s: number, lateral: number): { x: number; z: number; heading: number } {
  const p = pointAt(t, s)
  return { x: p.x + Math.cos(p.heading) * lateral, z: p.z - Math.sin(p.heading) * lateral, heading: p.heading }
}

/** 長彎：同號 |κ| ≥ 1/30 連續 ≥ 30（spec §1.2 LONG_CORNER_K／LONG_CORNER_MIN_LEN） */
export const LONG_CORNER_K = 1 / 30
export const LONG_CORNER_MIN_LEN = 30
/** 起跑格（spec §1.3）：第 i 格在起點線後 GRID_FIRST + GRID_GAP·i，左右交錯 ∓路寬/4 */
export const GRID_FIRST = 5
export const GRID_GAP = 4
export const GRID_SLOTS = 4

/** spec 的賽道表：位置一律用沿線距離 s（spec §1 的 s 值） */
export interface CourseSpec {
  ctrl: Vec2[]
  width: number
  /** 場地半邊長：|x| > bound.x 或 |z| > bound.z 即出界 */
  bound: { x: number; z: number }
  pads: { s: number; lateral: number }[]
  /** 跳台斜坡 [s0, s1] */
  jumps: [number, number][]
  itemRows: number[]
  /** 可甩尾長彎；省略時以 LONG_CORNER_K／LONG_CORNER_MIN_LEN 自動找 */
  driftZones?: [number, number][]
}

export interface Course {
  track: Track
  bound: { x: number; z: number }
  pads: { s: number; lateral: number; x: number; z: number; heading: number }[]
  jumps: [number, number][]
  itemRows: number[]
  driftZones: [number, number][]
  /** 起跑格（起點線後方），依實體序取 */
  grid: { x: number; z: number; ry: number }[]
}

export function makeCourse(spec: CourseSpec): Course {
  const track = makeTrack(spec.ctrl, spec.width)
  const grid = Array.from({ length: GRID_SLOTS }, (_, i) => {
    const p = placeAt(track, -(GRID_FIRST + GRID_GAP * i), ((i % 2) * 2 - 1) * (spec.width / 4))
    return { x: p.x, z: p.z, ry: p.heading }
  })
  return {
    track,
    bound: spec.bound,
    pads: spec.pads.map((p) => ({ s: p.s, lateral: p.lateral, ...placeAt(track, p.s, p.lateral) })),
    jumps: spec.jumps,
    itemRows: spec.itemRows,
    driftZones: spec.driftZones ?? findLongCurves(track, LONG_CORNER_K, LONG_CORNER_MIN_LEN),
    grid,
  }
}

/**
 * host 結算時機（AC6）：fins 為「仍在線的車」（含 bot）各自的過線時間或 null，
 * firstFinAt 為第一台過線的時間。全員過線，或第一台過線後 FINISH_GRACE_MS 到了才結束。
 */
export function raceOver(fins: readonly (number | null)[], firstFinAt: number | null, now: number): boolean {
  if (fins.length === 0 || firstFinAt === null) return false
  return fins.every((f) => f !== null) || now - firstFinAt >= FINISH_GRACE_MS
}
