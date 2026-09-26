import { describe, expect, it } from 'vitest'
import { buildKitchenHud, handFlights, idleKitchenHud } from '@/babylon/games/kitchenFx/hudModel'
import { ROUND_MS } from '@/babylon/games/overcookedKitchen'

const players = [
  { id: 'a', name: '小明' },
  { id: 'b', name: '阿華' },
]

describe('buildKitchenHud（共用契約 KitchenHud）', () => {
  const view = {
    remainMs: 83_401,
    score: 40,
    delivered: 2,
    orders: [
      { recipeId: 'veg-soup', ing: 'v' as const, remainMs: 12_345 },
      { recipeId: 'meat-soup', ing: 'm' as const, remainMs: 39_901 },
    ],
    hands: { a: { kind: 'soup' as const, ing: 'm' as const }, b: null },
  }
  const hud = buildKitchenHud({ view, ids: [7, 8], gone: [], players, selfId: 'b' })

  it('kind 標記、剩餘秒數量化到整秒（無條件進位）', () => {
    expect(hud.kind).toBe('kitchen')
    expect(hud.remainSec).toBe(84)
    expect(hud.score).toBe(40)
    expect(hud.delivered).toBe(2)
  })
  it('訂單帶穩定 id、remainMs 量化到 100ms（無條件進位，還在場的不會變 0）', () => {
    expect(hud.orders).toEqual([
      { id: 7, ing: 'v', remainMs: 12_400 },
      { id: 8, ing: 'm', remainMs: 40_000 },
    ])
    const tiny = buildKitchenHud({ view: { ...view, orders: [{ recipeId: 'x', ing: 'v', remainMs: 3 }] }, ids: [1], gone: [], players, selfId: 'a' })
    expect(tiny.orders[0].remainMs).toBe(100)
  })
  it('玩家卡：序號配色、isSelf 與手持物', () => {
    expect(hud.players).toEqual([
      { id: 'a', name: '小明', colorIndex: 0, isSelf: false, held: { ing: 'm', kind: 'soup' } },
      { id: 'b', name: '阿華', colorIndex: 1, isSelf: true, held: null },
    ])
  })
  it('每次都回新物件（setHud 靠參照比對）', () => {
    const again = buildKitchenHud({ view, ids: [7, 8], gone: [], players, selfId: 'b' })
    expect(again).not.toBe(hud)
    expect(again.orders).not.toBe(hud.orders)
    expect(again).toEqual(hud)
  })
})

describe('idleKitchenHud（開局倒數：新局的樣子）', () => {
  it('滿時間、0 分、沒訂單、空手', () => {
    const hud = idleKitchenHud(players, 'a')
    expect(hud).toMatchObject({ kind: 'kitchen', remainSec: ROUND_MS / 1000, score: 0, delivered: 0, orders: [], gone: [] })
    expect(hud.players.map((p) => p.held)).toEqual([null, null])
  })
})

describe('handFlights（手持物變化 → 拾取／放下）', () => {
  const soup = { kind: 'soup' as const, ing: 'v' as const }
  const raw = { kind: 'raw' as const, ing: 'm' as const }
  it('手上從空變有 → pickup、從有變空 → drop；不變不報', () => {
    expect(handFlights({ a: null, b: soup }, { a: raw, b: null })).toEqual([
      { pid: 'a', type: 'pickup' },
      { pid: 'b', type: 'drop' },
    ])
    expect(handFlights({ a: raw }, { a: raw })).toEqual([])
  })
  it('新加入的玩家不當成拾取', () => {
    expect(handFlights({}, { a: raw })).toEqual([])
  })
})
