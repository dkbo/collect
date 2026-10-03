/**
 * 坦克受擊、道具與 buff 規則（純函式）。host 用來裁決，各端用來算顯示。
 */

/** 被命中後的無敵時間：期間 host 不再扣血（子彈照樣消失） */
export const INVULN_MS = 1000
/** 受擊擊退距離（世界單位），以碰撞判定截斷 */
export const KNOCKBACK = 0.6
/** 護盾持續時間；抵擋下一發或到期即消失 */
export const SHIELD_MS = 12000
/** 三連發持續時間 */
export const TRIPLE_MS = 8000
/** 三連發左右兩發的偏角 */
export const TRIPLE_SPREAD_DEG = 12

/** 合法道具種類（網路封包驗證用），五種等機率 */
export const ITEM_KINDS = ['hp', 'speed', 'rapid', 'shield', 'triple'] as const
export type ItemKind = (typeof ITEM_KINDS)[number]

/** r ∈ [0,1) 均分成五段取道具；越界夾回 */
export const pickItemKind = (r: number): ItemKind => {
  const i = Math.floor(r * ITEM_KINDS.length)
  return ITEM_KINDS[Math.min(ITEM_KINDS.length - 1, Math.max(0, i))]
}

export interface Defense {
  hp: number
  shieldUntil: number
  invulnUntil: number
}

export interface HitOutcome {
  /** 是否扣血 */
  damaged: boolean
  /** 命中後血量 */
  hp: number
  /** 這發打破了護盾 */
  shieldBroken: boolean
  /** 命中時仍在無敵中（不重置無敵時間） */
  invuln: boolean
}

/** host 裁決一發命中：無敵 > 護盾 > 扣血 */
export function resolveHit(d: Defense, now: number): HitOutcome {
  if (d.invulnUntil > now) return { damaged: false, hp: d.hp, shieldBroken: false, invuln: true }
  if (d.shieldUntil > now) return { damaged: false, hp: d.hp, shieldBroken: true, invuln: false }
  return { damaged: true, hp: d.hp - 1, shieldBroken: false, invuln: false }
}

/** 沿 (dirX, dirZ) 推 dist，每 step 檢查一次碰撞，第一個會卡住的位置前停下 */
export function knockback(
  x: number,
  z: number,
  dirX: number,
  dirZ: number,
  dist: number,
  blocked: (x: number, z: number) => boolean,
  step = 0.05
): { x: number; z: number } {
  const len = Math.hypot(dirX, dirZ)
  if (len === 0 || dist <= 0) return { x, z }
  const ux = dirX / len
  const uz = dirZ / len
  let cx = x
  let cz = z
  for (let d = Math.min(step, dist); ; d = Math.min(d + step, dist)) {
    const tx = x + ux * d
    const tz = z + uz * d
    if (blocked(tx, tz)) break
    cx = tx
    cz = tz
    if (d >= dist) break
  }
  return { x: cx, z: cz }
}

/** 向量繞 Y 軸旋轉（與 turretAngle 同一慣例：方向 = (sin a, cos a)，正角往 +x 轉） */
const rotate = (vx: number, vz: number, rad: number): [number, number] => {
  const a = Math.atan2(vx, vz) + rad
  const s = Math.hypot(vx, vz)
  return [Math.sin(a) * s, Math.cos(a) * s]
}

/** 三連發：[中央, 左, 右]，速度大小不變 */
export function tripleVelocities(vx: number, vz: number): [number, number][] {
  const rad = (TRIPLE_SPREAD_DEG * Math.PI) / 180
  return [[vx, vz], rotate(vx, vz, -rad), rotate(vx, vz, rad)]
}

/** buff 剩餘秒數（無條件進位到整秒，到期為 0） */
export const buffRemainSec = (until: number, now: number): number => (until > now ? Math.ceil((until - now) / 1000) : 0)
