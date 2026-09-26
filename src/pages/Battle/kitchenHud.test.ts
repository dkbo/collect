import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import type { GameHud, KitchenHud, KitchenHudPlayer } from '@/babylon/types'
import { PLAYER_PALETTE } from '@/babylon/fx/palette'
import { ORDER_LIFE_MS, RECIPES, SCORE_EXPIRE, SCORE_SERVE } from '@/babylon/games/overcookedKitchen'
import { sameHud } from '@/pages/Battle/bomberHud'
import {
  KITCHEN_COLORS,
  KITCHEN_DISHES,
  KITCHEN_LEAVE_MS,
  clockView,
  collectLeaving,
  dishName,
  freshGone,
  goneFloatText,
  isKitchenHud,
  isRecipeToggleKey,
  orderLevel,
  orderRatio,
  orderRow,
  orderSeconds,
  sortKitchenPlayers,
} from '@/pages/Battle/kitchenHud'
import { KitchenHudView } from '@/pages/Battle/KitchenHud'

function player(colorIndex: 0 | 1 | 2 | 3, extra: Partial<KitchenHudPlayer> = {}): KitchenHudPlayer {
  return { id: `p${colorIndex}`, name: `廚師${colorIndex + 1}`, colorIndex, isSelf: false, held: null, ...extra }
}

/** 假資料（照 KitchenHud 共用契約）：4 人、3 張單分落綠／黃／紅三段 */
function kitchen(extra: Partial<KitchenHud> = {}): KitchenHud {
  return {
    kind: 'kitchen',
    remainSec: 84,
    score: 120,
    delivered: 6,
    orders: [
      { id: 7, ing: 'v', remainMs: 33_000 },
      { id: 8, ing: 'm', remainMs: 19_000 },
      { id: 9, ing: 'm', remainMs: 6_000 },
    ],
    gone: [],
    players: [
      player(0, { isSelf: true }),
      player(1, { held: { ing: 'v', kind: 'soup' } }),
      player(2),
      player(3, { held: { ing: 'm', kind: 'raw' } }),
    ],
    ...extra,
  }
}

const bomber: GameHud = {
  timer: { secondsLeft: 24, suddenDeath: false },
  aliveCount: 1,
  totalCount: 1,
  players: [],
}

describe('isKitchenHud', () => {
  it('kind 為 kitchen 才是廚房 HUD', () => {
    expect(isKitchenHud(kitchen())).toBe(true)
  })

  it('沒有 kind 的一律當 bomber', () => {
    expect(isKitchenHud(bomber)).toBe(false)
    expect(isKitchenHud(null)).toBe(false)
  })
})

describe('sameHud 擴充到 KitchenHud', () => {
  it('內容相同視為同一份（每幀 setHud 不重繪）', () => {
    expect(sameHud<KitchenHud>(kitchen(), kitchen())).toBe(true)
  })

  it('gone 或訂單剩餘時間不同就要重繪', () => {
    const served = kitchen({ gone: [{ id: 6, ing: 'v', reason: 'served', scoreDelta: SCORE_SERVE }] })
    expect(sameHud<KitchenHud>(kitchen(), served)).toBe(false)
    const tick = kitchen({ orders: [{ id: 7, ing: 'v', remainMs: 32_900 }] })
    expect(sameHud<KitchenHud>(kitchen(), tick)).toBe(false)
  })

  it('bomber 與 kitchen 互換時一定重繪', () => {
    expect(sameHud<GameHud | KitchenHud>(bomber, kitchen())).toBe(false)
  })
})

describe('照實顯示菜名與分數（裁決 ⑤）', () => {
  it('依 ing 顯示蔬菜湯／肉湯，與 RECIPES 同名', () => {
    const name = (id: string) => RECIPES.find((r) => r.id === id)?.name
    expect(dishName('v')).toBe(name('veg-soup'))
    expect(dishName('m')).toBe(name('meat-soup'))
  })

  it('食譜只列兩道，分數取 SCORE_SERVE', () => {
    expect(KITCHEN_DISHES.map((d) => d.ing)).toEqual(['v', 'm'])
    expect(KITCHEN_DISHES.every((d) => d.score === SCORE_SERVE)).toBe(true)
  })
})

describe('訂單計時條', () => {
  it('比例以 ORDER_LIFE_MS 計並夾在 0–1', () => {
    expect(orderRatio(ORDER_LIFE_MS / 2)).toBe(0.5)
    expect(orderRatio(ORDER_LIFE_MS * 2)).toBe(1)
    expect(orderRatio(-100)).toBe(0)
  })

  it('綠 >50%、黃 25–50%、紅 <25%', () => {
    expect(orderLevel(ORDER_LIFE_MS * 0.51)).toBe('ok')
    expect(orderLevel(ORDER_LIFE_MS * 0.5)).toBe('warn')
    expect(orderLevel(ORDER_LIFE_MS * 0.25)).toBe('warn')
    expect(orderLevel(ORDER_LIFE_MS * 0.24)).toBe('danger')
    expect(orderLevel(0)).toBe('danger')
  })

  it('秒數無條件進位、不為負', () => {
    expect(orderSeconds(5_100)).toBe(6)
    expect(orderSeconds(6_000)).toBe(6)
    expect(orderSeconds(-1)).toBe(0)
  })
})

describe('計時＋分數膠囊', () => {
  it('m:ss 顯示', () => {
    expect(clockView(84).text).toBe('1:24')
  })

  it('最後 15 秒（含）變紅跳動', () => {
    expect(clockView(16).urgent).toBe(false)
    expect(clockView(15).urgent).toBe(true)
    expect(clockView(0).urgent).toBe(true)
  })
})

describe('消失訂單（gone）的離場動畫', () => {
  it('逾時浮出實際扣分，為 0 時不顯示', () => {
    expect(goneFloatText({ id: 1, ing: 'v', reason: 'expired', scoreDelta: SCORE_EXPIRE })).toBe('-10')
    expect(goneFloatText({ id: 1, ing: 'v', reason: 'expired', scoreDelta: 0 })).toBeNull()
  })

  it('出餐只打勾飛出，不浮字', () => {
    expect(goneFloatText({ id: 1, ing: 'v', reason: 'served', scoreDelta: SCORE_SERVE })).toBeNull()
  })

  it('出餐與逾時同一幀：各自帶上一張快照的槽位與剩餘時間、key 不重複', () => {
    const prev = kitchen().orders
    const out = collectLeaving(
      prev,
      [
        { id: 9, ing: 'm', reason: 'expired', scoreDelta: SCORE_EXPIRE },
        { id: 8, ing: 'm', reason: 'served', scoreDelta: SCORE_SERVE },
      ],
      41,
    )
    expect(out.map((l) => [l.id, l.reason, l.slot, l.remainMs])).toEqual([
      [9, 'expired', 2, 6_000],
      [8, 'served', 1, 19_000],
    ])
    expect(out.map((l) => l.key)).toEqual(['41', '42'])
  })

  it('上一張快照找不到該單時退回依序排、剩餘 0', () => {
    const out = collectLeaving([], [{ id: 3, ing: 'v', reason: 'expired', scoreDelta: 0 }], 0)
    expect(out[0]).toMatchObject({ slot: 0, remainMs: 0 })
  })

  it('只收上一張 HUD 還在場的消失單（每幀重送同一份 gone 不重播）', () => {
    const prev = kitchen().orders
    const gone = [
      { id: 8, ing: 'm' as const, reason: 'served' as const, scoreDelta: SCORE_SERVE },
      { id: 3, ing: 'v' as const, reason: 'expired' as const, scoreDelta: SCORE_EXPIRE },
    ]
    expect(freshGone(prev, gone).map((g) => g.id)).toEqual([8])
    const after = prev.filter((o) => o.id !== 8)
    expect(freshGone(after, gone)).toEqual([])
  })

  it('離場卡排回原槽位：後面的單不會立刻左移、被離場卡蓋住', () => {
    const prev = kitchen().orders
    const leaving = collectLeaving(prev, [{ id: 7, ing: 'v', reason: 'expired', scoreDelta: 0 }], 0)
    const now = [...prev.slice(1), { id: 10, ing: 'v' as const, remainMs: 40_000 }]
    expect(orderRow(now, leaving).map((c) => (c.leave ? `x${c.leave.id}` : c.order.id))).toEqual(['x7', 8, 9, 10])
  })

  it('出餐與逾時同一幀：兩張離場卡各回各的槽位', () => {
    const prev = kitchen().orders
    const leaving = collectLeaving(
      prev,
      [
        { id: 9, ing: 'm', reason: 'expired', scoreDelta: SCORE_EXPIRE },
        { id: 7, ing: 'v', reason: 'served', scoreDelta: SCORE_SERVE },
      ],
      0,
    )
    expect(orderRow([prev[1]], leaving).map((c) => (c.leave ? `x${c.leave.id}` : c.order.id))).toEqual(['x7', 8, 'x9'])
  })

  it('槽位超出現有張數時接在尾端', () => {
    const leaving = collectLeaving(kitchen().orders, [{ id: 9, ing: 'm', reason: 'served', scoreDelta: SCORE_SERVE }], 0)
    expect(orderRow([], leaving).map((c) => c.leave?.id)).toEqual([9])
  })

  it('靜態渲染：離場卡在 DOM 順序上排在原槽位', () => {
    const prev = kitchen().orders
    const leaving = collectLeaving(prev, [{ id: 7, ing: 'v', reason: 'expired', scoreDelta: SCORE_EXPIRE }], 0)
    const html = renderToStaticMarkup(createElement(KitchenHudView, { hud: kitchen({ orders: prev.slice(1) }), leaving }))
    const at = (s: string) => html.indexOf(s)
    expect(at('data-leaving="expired"')).toBeGreaterThan(-1)
    expect(at('data-leaving="expired"')).toBeLessThan(at('data-kitchen-order="8"'))
  })

  it('離場動畫時長：出餐 600ms、逾時 400ms', () => {
    expect(KITCHEN_LEAVE_MS).toEqual({ served: 600, expired: 400 })
  })
})

describe('玩家卡', () => {
  it('依 P 編號排序、只列實際人數', () => {
    const sorted = sortKitchenPlayers([player(2), player(0)])
    expect(sorted.map((p) => p.colorIndex)).toEqual([0, 2])
  })

  it('色票直接取 fx/palette，不另存一份', () => {
    expect(KITCHEN_COLORS).toBe(PLAYER_PALETTE)
  })
})

describe('食譜收合鍵', () => {
  it('R／r 無修飾鍵才收合', () => {
    expect(isRecipeToggleKey({ key: 'r', repeat: false, ctrlKey: false, metaKey: false, altKey: false })).toBe(true)
    expect(isRecipeToggleKey({ key: 'R', repeat: false, ctrlKey: false, metaKey: false, altKey: false })).toBe(true)
  })

  it('長按重複、Ctrl+R（重新整理）與其他鍵不收合', () => {
    expect(isRecipeToggleKey({ key: 'r', repeat: true, ctrlKey: false, metaKey: false, altKey: false })).toBe(false)
    expect(isRecipeToggleKey({ key: 'r', repeat: false, ctrlKey: true, metaKey: false, altKey: false })).toBe(false)
    expect(isRecipeToggleKey({ key: 'e', repeat: false, ctrlKey: false, metaKey: false, altKey: false })).toBe(false)
  })
})

describe('KitchenHudView 元件（假資料靜態渲染）', () => {
  const render = (hud: KitchenHud, leaving = collectLeaving([], [], 0)) =>
    renderToStaticMarkup(createElement(KitchenHudView, { hud, leaving }))

  it('根節點 [data-kitchen-hud]，不出現 bomber HUD', () => {
    const html = render(kitchen())
    expect(html).toContain('data-kitchen-hud=""')
    expect(html).not.toContain('data-bomber-hud')
  })

  it('訂單卡照實顯示菜名、+SCORE_SERVE 與三段計時色', () => {
    const html = render(kitchen())
    expect(html.match(/data-kitchen-order="/g)).toHaveLength(3)
    expect(html).toContain('蔬菜湯')
    expect(html).toContain('肉湯')
    expect(html).not.toContain('烤肉拼盤')
    expect(html).toContain(`+${SCORE_SERVE}`)
    for (const lv of ['ok', 'warn', 'danger']) expect(html).toContain(`data-level="${lv}"`)
  })

  it('玩家卡只列實際人數，自己掛「你」', () => {
    const solo = render(kitchen({ players: [player(0, { isSelf: true })] }))
    expect(solo.match(/data-kitchen-player="/g)).toHaveLength(1)
    expect(solo).toContain('data-self="true"')
    const four = render(kitchen())
    expect(four.match(/data-kitchen-player="/g)).toHaveLength(4)
    expect(four).toContain('data-held="soup-v"')
    expect(four).toContain('data-held="none"')
  })

  it('計時膠囊顯示 m:ss、分數與出餐數，最後 15 秒標 urgent', () => {
    const html = render(kitchen())
    expect(html).toContain('1:24')
    expect(html).toContain('120')
    expect(html).toContain('出餐 6')
    expect(render(kitchen({ remainSec: 10 }))).toContain('data-urgent="true"')
  })

  it('食譜預設展開、列兩道菜', () => {
    const html = render(kitchen())
    expect(html).toContain('data-open="true"')
    expect(html.match(/data-kitchen-recipe="/g)).toHaveLength(2)
  })

  it('離場卡：逾時掉落並浮實際扣分、出餐打勾、分數 0 的逾時不浮字', () => {
    const prev = kitchen().orders
    const leaving = collectLeaving(
      prev,
      [
        { id: 9, ing: 'm', reason: 'expired', scoreDelta: SCORE_EXPIRE },
        { id: 8, ing: 'm', reason: 'served', scoreDelta: SCORE_SERVE },
        { id: 7, ing: 'v', reason: 'expired', scoreDelta: 0 },
      ],
      0,
    )
    const html = render(kitchen({ orders: [] }), leaving)
    expect(html).toContain('data-leaving="expired"')
    expect(html).toContain('data-leaving="served"')
    expect(html.match(/kitchen-order-float/g)).toHaveLength(1)
    expect(html).toContain('-10')
  })
})
