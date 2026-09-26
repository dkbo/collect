import { describe, expect, it } from 'vitest'
import {
  COOK_MS,
  ORDER_LIFE_MS,
  OVERCOOK_MS,
  SCORE_EXPIRE,
  SCORE_SERVE,
  applyUse,
  buildView,
  createKitchen,
  tickKitchen,
  type Kitchen,
} from '@/babylon/games/overcookedKitchen'

const P = 'p1'
const T0 = 1000
/** 不出新單（rand 只在補單時用；把 nextOrderAt 推遠即可） */
const noRand = () => 0

/** 把一份切好的 ing 放進 pot-0，tick 到煮好；回傳 soup 開始的時刻 */
function cookSoup(k: Kitchen, ing: 'v' | 'm' = 'v'): number {
  k.nextOrderAt = Number.POSITIVE_INFINITY
  k.hands[P] = { kind: 'chop', ing }
  expect(applyUse(k, P, 'pot-0', T0)).toBe(true)
  const soupAt = T0 + COOK_MS
  tickKitchen(k, soupAt, noRand)
  expect(k.slots['pot-0'].item).toEqual({ kind: 'soup', ing })
  return soupAt
}

const potView = (k: Kitchen, now: number) => buildView(k, now).slots.find((s) => s.id === 'pot-0')!

describe('取湯（AC2）', () => {
  it('煮好當下空手即可取走 soup', () => {
    const k = createKitchen([P], 0)
    const soupAt = cookSoup(k)
    expect(applyUse(k, P, 'pot-0', soupAt)).toBe(true)
    expect(k.hands[P]).toEqual({ kind: 'soup', ing: 'v' })
    expect(k.slots['pot-0'].item).toBeNull()
  })

  it('煮好後 0–5 秒內任何時刻都能取到 soup（不需等 busyUntil）', () => {
    for (const dt of [1, 2000, 4000, OVERCOOK_MS - 1]) {
      const k = createKitchen([P], 0)
      const soupAt = cookSoup(k, 'm')
      tickKitchen(k, soupAt + dt, noRand)
      expect(applyUse(k, P, 'pot-0', soupAt + dt)).toBe(true)
      expect(k.hands[P]).toEqual({ kind: 'soup', ing: 'm' })
    }
  })

  it('超過 5 秒變 burnt，burnt 照舊可取', () => {
    const k = createKitchen([P], 0)
    const soupAt = cookSoup(k)
    tickKitchen(k, soupAt + OVERCOOK_MS, noRand)
    expect(k.slots['pot-0'].item).toEqual({ kind: 'burnt', ing: 'v' })
    expect(applyUse(k, P, 'pot-0', soupAt + OVERCOOK_MS + 10)).toBe(true)
    expect(k.hands[P]).toEqual({ kind: 'burnt', ing: 'v' })
  })

  it('煮的過程中（chop 在鍋裡）不能取', () => {
    const k = createKitchen([P], 0)
    k.hands[P] = { kind: 'chop', ing: 'v' }
    applyUse(k, P, 'pot-0', T0)
    expect(applyUse(k, P, 'pot-0', T0 + COOK_MS - 1)).toBe(false)
    expect(k.hands[P]).toBeNull()
  })

  it('手上有東西時不能取湯', () => {
    const k = createKitchen([P], 0)
    const soupAt = cookSoup(k)
    k.hands[P] = { kind: 'raw', ing: 'm' }
    expect(applyUse(k, P, 'pot-0', soupAt + 100)).toBe(false)
    expect(k.slots['pot-0'].item).toEqual({ kind: 'soup', ing: 'v' })
  })
})

describe('快焦 progress 語意（⑥，buildView 算式不變）', () => {
  it('soup 前 2 秒 progress 為 0', () => {
    const k = createKitchen([P], 0)
    const soupAt = cookSoup(k)
    for (const dt of [0, 1000, OVERCOOK_MS - COOK_MS]) expect(potView(k, soupAt + dt).progress).toBe(0)
  })

  it('之後 0→1 線性上升（剩 3 秒時開始）', () => {
    const k = createKitchen([P], 0)
    const soupAt = cookSoup(k)
    const start = soupAt + OVERCOOK_MS - COOK_MS
    expect(potView(k, start + COOK_MS / 2).progress).toBeCloseTo(0.5)
    expect(potView(k, start + COOK_MS - 30).progress).toBeCloseTo(0.99)
    expect(potView(k, start + 1).progress).toBeGreaterThan(0)
  })

  it('煮的過程 progress 0→1', () => {
    const k = createKitchen([P], 0)
    k.hands[P] = { kind: 'chop', ing: 'v' }
    applyUse(k, P, 'pot-0', T0)
    expect(potView(k, T0).progress).toBe(0)
    expect(potView(k, T0 + COOK_MS / 2).progress).toBeCloseTo(0.5)
  })
})

describe('出餐與訂單', () => {
  it('送對 ing 得 SCORE_SERVE、訂單消失、出餐數 +1', () => {
    const k = createKitchen([P], 0)
    k.orders.push({ id: 1, recipeId: 'meat-soup', ing: 'm', expiresAt: T0 + ORDER_LIFE_MS })
    k.hands[P] = { kind: 'soup', ing: 'm' }
    expect(applyUse(k, P, 'serve', T0)).toBe(true)
    expect(k.score).toBe(SCORE_SERVE)
    expect(k.delivered).toBe(1)
    expect(k.orders).toHaveLength(0)
    expect(k.hands[P]).toBeNull()
  })

  it('送錯 ing 或送 burnt 不收', () => {
    const k = createKitchen([P], 0)
    k.orders.push({ id: 1, recipeId: 'veg-soup', ing: 'v', expiresAt: T0 + ORDER_LIFE_MS })
    k.hands[P] = { kind: 'soup', ing: 'm' }
    expect(applyUse(k, P, 'serve', T0)).toBe(false)
    k.hands[P] = { kind: 'burnt', ing: 'v' }
    expect(applyUse(k, P, 'serve', T0)).toBe(false)
    expect(k.score).toBe(0)
    expect(k.orders).toHaveLength(1)
  })

  it('訂單逾時扣 SCORE_EXPIRE，分數下限 0', () => {
    const k = createKitchen([P], 0)
    k.nextOrderAt = Number.POSITIVE_INFINITY
    k.score = 30
    k.orders.push({ id: 1, recipeId: 'veg-soup', ing: 'v', expiresAt: T0 })
    k.orders.push({ id: 2, recipeId: 'meat-soup', ing: 'm', expiresAt: T0 + 5 })
    tickKitchen(k, T0, noRand)
    expect(k.score).toBe(30 + SCORE_EXPIRE)
    expect(k.orders.map((o) => o.id)).toEqual([2])
    k.score = 5
    tickKitchen(k, T0 + 5, noRand)
    expect(k.score).toBe(0)
    expect(k.orders).toHaveLength(0)
  })
})
