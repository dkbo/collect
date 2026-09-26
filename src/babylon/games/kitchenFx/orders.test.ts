import { describe, expect, it } from 'vitest'
import { trackOrders, type OrderSnap, type OrderTrack } from '@/babylon/games/kitchenFx/orders'
import { SCORE_EXPIRE, SCORE_SERVE } from '@/babylon/games/overcookedKitchen'

const o = (ing: 'v' | 'm', remainMs: number, recipeId = ing === 'v' ? 'veg-soup' : 'meat-soup') => ({ recipeId, ing, remainMs })
const snap = (orders: OrderSnap['orders'], p: Partial<Omit<OrderSnap, 'orders'>> = {}): OrderSnap => ({
  orders,
  score: 0,
  delivered: 0,
  remainMs: 100_000,
  ...p,
})
/** 依序餵多張快照，回最後一次的結果 */
const feed = (...snaps: OrderSnap[]) => {
  let track: OrderTrack | null = null
  let last = trackOrders(null, snaps[0])
  for (const s of snaps) {
    last = trackOrders(track, s)
    track = last.track
  }
  return last
}

describe('trackOrders：訂單 id 穩定化', () => {
  it('第一張快照依序編號、沒有消失單', () => {
    const r = trackOrders(null, snap([o('v', 30_000), o('m', 38_000)]))
    expect(r.track.ids).toEqual([1, 2])
    expect(r.gone).toEqual([])
  })

  it('剩餘時間照常遞減時 id 不變', () => {
    const r = feed(snap([o('v', 30_000), o('m', 38_000)]), snap([o('v', 29_875), o('m', 37_875)], { remainMs: 99_875 }))
    expect(r.track.ids).toEqual([1, 2])
    expect(r.gone).toEqual([])
  })

  it('新單接在後面拿新 id', () => {
    const r = feed(snap([o('v', 30_000)]), snap([o('v', 29_875), o('m', 40_000)], { remainMs: 99_875 }))
    expect(r.track.ids).toEqual([1, 2])
  })

  it('同一幀舊單逾時、同菜新單補上：舊單消失，新單拿新 id', () => {
    const r = feed(snap([o('v', 60)]), snap([o('v', 39_990)], { remainMs: 99_875 }))
    expect(r.track.ids).toEqual([2])
    expect(r.gone).toEqual([{ id: 1, ing: 'v', reason: 'expired', scoreDelta: 0 }])
  })

  it('新局（剩餘時間回升）重新編號、不算消失', () => {
    const r = feed(snap([o('v', 30_000)], { remainMs: 1_000, score: 40, delivered: 2 }), snap([o('m', 40_000)], { remainMs: 120_000 }))
    expect(r.gone).toEqual([])
    expect(r.track.ids).toEqual([2])
  })
})

describe('trackOrders：消失原因（host findIndex：同 ing 取最早那張）', () => {
  it('同 ing 兩張單其中一張出餐：最早那張是 served，後面那張留著', () => {
    const r = feed(
      snap([o('v', 30_000), o('v', 38_000)]),
      snap([o('v', 37_875)], { remainMs: 99_875, delivered: 1, score: SCORE_SERVE })
    )
    expect(r.gone).toEqual([{ id: 1, ing: 'v', reason: 'served', scoreDelta: SCORE_SERVE }])
    expect(r.track.ids).toEqual([2])
  })

  it('出餐與逾時同一幀（先逾時再出餐）：快到期那張 expired、另一張同 ing 的 served', () => {
    const r = feed(
      snap([o('v', 60), o('m', 20_000), o('v', 30_000)], { score: 50 }),
      snap([o('m', 19_875)], { remainMs: 99_875, delivered: 1, score: 50 + SCORE_SERVE + SCORE_EXPIRE })
    )
    expect(r.gone).toEqual([
      { id: 1, ing: 'v', reason: 'expired', scoreDelta: SCORE_EXPIRE },
      { id: 3, ing: 'v', reason: 'served', scoreDelta: SCORE_SERVE },
    ])
    expect(r.track.ids).toEqual([2])
  })

  it('快到期的單在同一幀被送出去：算 served', () => {
    const r = feed(snap([o('v', 60), o('m', 20_000)]), snap([o('m', 19_875)], { remainMs: 99_875, delivered: 1, score: SCORE_SERVE }))
    expect(r.gone).toEqual([{ id: 1, ing: 'v', reason: 'served', scoreDelta: SCORE_SERVE }])
  })

  it('分數為 0 時逾時：expired、實際扣分 0', () => {
    const r = feed(snap([o('m', 50)]), snap([], { remainMs: 99_875 }))
    expect(r.gone).toEqual([{ id: 1, ing: 'm', reason: 'expired', scoreDelta: 0 }])
  })

  it('分數有剩時逾時：扣實際的 SCORE_EXPIRE', () => {
    const r = feed(snap([o('m', 50)], { score: 30 }), snap([], { remainMs: 99_875, score: 30 + SCORE_EXPIRE }))
    expect(r.gone).toEqual([{ id: 1, ing: 'm', reason: 'expired', scoreDelta: SCORE_EXPIRE }])
  })

  it('兩張同時逾時但分數只剩 5：依序分攤成 -5 與 0', () => {
    const r = feed(snap([o('v', 40), o('m', 60)], { score: 5 }), snap([], { remainMs: 99_875, score: 0 }))
    expect(r.gone.map((g) => g.scoreDelta)).toEqual([-5, 0])
    expect(r.gone.every((g) => g.reason === 'expired')).toBe(true)
  })

  it('同一張快照重送（內容相同）不會再報消失', () => {
    const a = snap([o('v', 60), o('m', 20_000)])
    const b = snap([o('m', 19_875)], { remainMs: 99_875, delivered: 1, score: SCORE_SERVE })
    const r1 = trackOrders(trackOrders(null, a).track, b)
    const r2 = trackOrders(r1.track, b)
    expect(r1.gone).toHaveLength(1)
    expect(r2.gone).toEqual([])
    expect(r2.track.ids).toEqual(r1.track.ids)
  })
})
