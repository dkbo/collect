/**
 * A Toy Racer 賽道資料（design/spec.md §1、§2.1 照抄）：控制點、路寬、跳台、加速帶、道具箱、長彎、落後補償表。
 * race.ts 只 import 這裡，不另抄一份。所有位置是沿線距離 s（spec 以每段 16 點取樣量出）。
 */
import type { ItemKind } from '@/babylon/games/raceRules/items'
import { makeCourse, type Vec2 } from '@/babylon/games/raceRules/track'

export const TRACK_WIDTH = 12

/** 中心線控制點（閉合，48 點；第 0 點為起跑線，往 +x 出發，逆時針） */
export const TRACK_CTRL: Vec2[] = [
  [-8, -72], [5, -72], [17.5, -72], [30.5, -72], [43, -72], [56, -72], [65, -70.5], [72.5, -65.5],
  [78, -58], [80, -49], [78.5, -40], [74, -26.5], [69, -13.5], [64, -0.5], [59.5, 13], [54.5, 26],
  [50, 39], [45, 52.5], [40, 65.5], [35, 71.5], [27, 73], [20, 69], [17, 61.5], [17, 46],
  [17, 30.5], [17, 15], [17, -0.5], [13, -10], [4, -13.5], [-14, -13.5], [-20.5, -12], [-25.5, -7.5],
  [-30.5, -3.5], [-37, -1.5], [-51, -1.5], [-65, -1.5], [-72.5, -3.5], [-78, -9], [-80, -16.5], [-80, -30],
  [-80, -43.5], [-80, -57], [-78, -64.5], [-72.5, -70], [-65, -72], [-50.5, -72], [-36.5, -72], [-22, -72],
]

/** 場地半邊長（地面桌墊 200×180，spec §1.1） */
export const RACE_BOUND = { x: 100, z: 90 }

/** 跳台斜坡（spec §1.4） */
export const JUMP_S0 = 150
export const JUMP_S1 = 156

/** 固定加速帶（spec §1.5）：s 與 lateral（右正） */
export const BOOST_PADS: { s: number; lateral: number }[] = [
  { s: 143, lateral: 0 },
  { s: 262, lateral: 3 },
  { s: 394, lateral: -3 },
]

/** 道具箱列的 s（spec §1.6），每列 4 個 */
export const ITEM_ROW_S = [122, 295, 452]
export const ITEM_ROWS = ITEM_ROW_S.length

/** 可甩尾長彎（spec §1.2；dir −1 = 左彎）；bot 在 [s0 − 4, s1 − 6] 按住甩尾 */
export const LONG_CORNERS: { s0: number; s1: number; dir: -1 | 1 }[] = [
  { s0: 69, s1: 106, dir: -1 }, // T1 左 ~92°
  { s0: 223, s1: 256, dir: -1 }, // T2 髮夾 ~146°
]

/**
 * 落後補償（spec §2.1）：檔 0 = 第 1 名、3 = 最後一名；鍵順序即抽取的累加順序。
 * P(mushroom∪shell) = 0 / 0.5 / 0.65 / 0.8。
 */
export const ITEM_ODDS: readonly Record<ItemKind, number>[] = [
  { banana: 0.6, shell: 0, mushroom: 0, shield: 0.4 },
  { banana: 0.35, shell: 0.3, mushroom: 0.2, shield: 0.15 },
  { banana: 0.2, shell: 0.35, mushroom: 0.3, shield: 0.15 },
  { banana: 0.1, shell: 0.35, mushroom: 0.45, shield: 0.1 },
]

export const RACE_COURSE = makeCourse({
  ctrl: TRACK_CTRL,
  width: TRACK_WIDTH,
  bound: RACE_BOUND,
  pads: BOOST_PADS,
  jumps: [[JUMP_S0, JUMP_S1]],
  itemRows: ITEM_ROW_S,
  driftZones: LONG_CORNERS.map((c) => [c.s0, c.s1]),
})
