/**
 * 廚房快手的角色姿勢與擺放（純函式，可在 node 單測；kitchen spec §4／§5）：
 * 渲染座標（cy=0 的食材箱／出餐口排在遠側靠背牆）、物品 mesh 分組鍵、砍菜判定、手臂角度。
 */
import type { Item, ItemKind, Ing } from '@/babylon/games/overcookedKitchen'

/** 格 → 世界 z：cy=0 在遠側（+z，靠背牆），與方向稿同向；各端同一份函式，位置同步不受影響 */
export const kitchenZ = (cy: number, count: number, cell: number): number => ((count - 1) / 2 - cy) * cell
/** kitchenZ 的反函式（碰撞用） */
export const kitchenCellZ = (z: number, count: number, cell: number): number => Math.round((count - 1) / 2 - z / cell) || 0 // 不回 -0

export type ItemKey = `${ItemKind}-${Ing}`
const KINDS: readonly ItemKind[] = ['raw', 'chop', 'soup', 'burnt']
const INGS: readonly Ing[] = ['v', 'm']
/** 8 種物品 mesh（kind × ing），站點與手上共用同一批外形 */
export const ITEM_KEYS: readonly ItemKey[] = KINDS.flatMap((k) => INGS.map((i) => `${k}-${i}` as ItemKey))
export const itemKey = (it: Item): ItemKey => `${it.kind}-${it.ing}`

export interface BoardSpot {
  x: number
  z: number
  /** 砧板上有生食材、正在切 */
  chopping: boolean
}

/** 範圍內最近的加工中砧板（沒有回 null）：站在旁邊的人播砍菜動作並面向它 */
export function chopTarget<T extends BoardSpot>(x: number, z: number, boards: readonly T[], range: number): T | null {
  let best: T | null = null
  let bestD = range
  for (const b of boards) {
    if (!b.chopping) continue
    const d = Math.hypot(b.x - x, b.z - z)
    if (d < bestD) {
      bestD = d
      best = b
    }
  }
  return best
}

/** 手持物時雙手抬到胸前的角度（Babylon rotation.x，負值往前抬） */
export const HOLD_ARM = -1.1
/** 手持物時雙手往內收的量（身體座標） */
export const HOLD_INWARD = 0.1
/** 砍菜頻率與擺幅（spec §4：X 軸 ±0.9、4Hz），中心往前抬 */
export const CHOP_HZ = 4
const CHOP_AMP = 0.9
const CHOP_CENTER = -0.9
/** 砍菜時左手扶著食材 */
const CHOP_LEFT = -0.6

export interface ArmPose {
  armL: number
  armR: number
  /** 雙手往身體中線內收的量 */
  inward: number
}

/** 手臂姿勢：手持優先（胸前捧著）> 切菜（右手上下砍）> 走路擺動（與腿反向） */
export function chefArms(o: { swing: number; holding: boolean; chopping: boolean; tMs: number }): ArmPose {
  if (o.holding) return { armL: HOLD_ARM, armR: HOLD_ARM, inward: HOLD_INWARD }
  if (o.chopping) {
    const ph = (o.tMs / 1000) * CHOP_HZ * Math.PI * 2
    return { armL: CHOP_LEFT, armR: CHOP_CENTER + CHOP_AMP * Math.sin(ph), inward: 0 }
  }
  return { armL: -o.swing, armR: o.swing, inward: 0 }
}
