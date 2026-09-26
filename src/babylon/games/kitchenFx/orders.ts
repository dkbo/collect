/**
 * 訂單 id 穩定化與消失原因判定（KitchenHud 共用契約；純函式，可在 node 單測）。
 *
 * 快照（KitchenView）的訂單沒有 id，這裡比對前後兩張推出來，不改快照：
 * - host 補單只接在尾端、移除用 splice，所以留下來的單是上一張的子序列、順序不變；
 * - 同一張單的剩餘時間只會變少，新單剩餘時間接近 ORDER_LIFE_MS，
 *   而兩張單的建立時間至少差 ORDER_EVERY_MS，所以快照間隔在 8 秒內都不會認錯。
 * 消失的單：delivered 增量 d 張照 host 的 findIndex（同 ing 取最早那張）算 served，其餘 expired；
 * 「剩餘時間撐不到這一張」的單才可能逾時，撐得到卻不見了的一定是被送出去的。
 */
import { SCORE_EXPIRE, SCORE_SERVE, type Ing } from '@/babylon/games/overcookedKitchen'
import type { KitchenHudGone } from '@/babylon/types'

export interface SnapOrder {
  recipeId: string
  ing: Ing
  remainMs: number
}

/** trackOrders 需要的快照欄位（KitchenView 的子集） */
export interface OrderSnap {
  orders: readonly SnapOrder[]
  score: number
  delivered: number
  /** 本局剩餘毫秒（兩張快照的差＝經過時間；回升＝新局） */
  remainMs: number
}

export interface OrderTrack {
  snap: OrderSnap
  /** 與 snap.orders 同序的穩定 id */
  ids: number[]
  nextId: number
}

/** 時間比對容差（ms） */
const EPS = 50

const sameSnap = (a: OrderSnap, b: OrderSnap): boolean =>
  a.score === b.score &&
  a.delivered === b.delivered &&
  a.remainMs === b.remainMs &&
  a.orders.length === b.orders.length &&
  a.orders.every((o, i) => o.recipeId === b.orders[i].recipeId && o.ing === b.orders[i].ing && o.remainMs === b.orders[i].remainMs)

const fresh = (snap: OrderSnap, nextId: number): OrderTrack => ({
  snap,
  ids: snap.orders.map((_, i) => nextId + i),
  nextId: nextId + snap.orders.length,
})

export function trackOrders(prev: OrderTrack | null, snap: OrderSnap): { track: OrderTrack; gone: KitchenHudGone[] } {
  if (!prev) return { track: fresh(snap, 1), gone: [] }
  if (sameSnap(prev.snap, snap)) return { track: { ...prev, snap }, gone: [] }
  const p = prev.snap
  // 新局：剩餘時間回升或出餐數倒退（重建廚房）
  if (snap.remainMs > p.remainMs + EPS || snap.delivered < p.delivered) return { track: fresh(snap, prev.nextId), gone: [] }

  // 子序列比對：新單只接在尾端，比不上的從那裡起全是新單
  const ids: number[] = []
  const matched = new Set<number>()
  let nextId = prev.nextId
  let i = 0
  let dt = Math.max(0, p.remainMs - snap.remainMs)
  for (const n of snap.orders) {
    let hit = -1
    for (let j = i; j < p.orders.length; j++) {
      const q = p.orders[j]
      if (q.recipeId === n.recipeId && q.ing === n.ing && n.remainMs <= q.remainMs + EPS) {
        hit = j
        break
      }
    }
    if (hit < 0) {
      ids.push(nextId++)
      i = p.orders.length
      continue
    }
    ids.push(prev.ids[hit])
    matched.add(hit)
    dt = Math.max(dt, p.orders[hit].remainMs - n.remainMs)
    i = hit + 1
  }

  const goneIdx = p.orders.map((_, j) => j).filter((j) => !matched.has(j))
  const gone: KitchenHudGone[] = []
  if (goneIdx.length > 0) {
    const d = Math.max(0, Math.min(goneIdx.length, snap.delivered - p.delivered))
    const canExpire = (j: number) => p.orders[j].remainMs - dt <= EPS
    const served = new Set<number>()
    // 撐得到這一張卻不見了：只可能是出餐
    for (const j of goneIdx) if (served.size < d && !canExpire(j)) served.add(j)
    // 還不夠：從快到期的單裡依序補（同 ing 最早那張先被 findIndex 挑中）
    for (const j of goneIdx) if (served.size < d && !served.has(j)) served.add(j)
    let rest = snap.score - p.score - served.size * SCORE_SERVE
    for (const j of goneIdx) {
      const q = p.orders[j]
      if (served.has(j)) {
        gone.push({ id: prev.ids[j], ing: q.ing, reason: 'served', scoreDelta: SCORE_SERVE })
        continue
      }
      // 逾時依序扣分，分數下限 0 時扣不到的記 0
      const delta = Math.min(0, Math.max(SCORE_EXPIRE, rest))
      rest -= delta
      gone.push({ id: prev.ids[j], ing: q.ing, reason: 'expired', scoreDelta: delta })
    }
  }
  return { track: { snap, ids, nextId }, gone }
}
