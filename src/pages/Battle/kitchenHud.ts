import { PLAYER_PALETTE } from '@/babylon/fx/palette'
import { ORDER_LIFE_MS, RECIPES, SCORE_SERVE } from '@/babylon/games/overcookedKitchen'
import type { GameHud, KitchenHud, KitchenHudGone, KitchenHudOrder, KitchenHudPlayer, KitchenIng } from '@/babylon/types'
import { formatTimer } from '@/pages/Battle/bomberHud'

/** 固定 4 色（kitchen spec §4），與 3D 廚師同源；索引 = colorIndex */
export const KITCHEN_COLORS = PLAYER_PALETTE

/** 剩這麼多秒（含）以內計時膠囊變紅跳動 */
const URGENT_SECONDS = 15
/** 計時條分級門檻（剩餘比例） */
const WARN_RATIO = 0.5
const DANGER_RATIO = 0.25

/** 離場動畫時長（spec §7：出餐 600ms、逾時 400ms） */
export const KITCHEN_LEAVE_MS = { served: 600, expired: 400 } as const

/** setHud 收到的是不是廚房 HUD（沒有 kind 的一律當 bomber） */
export function isKitchenHud(hud: GameHud | KitchenHud | null): hud is KitchenHud {
  return hud !== null && 'kind' in hud && hud.kind === 'kitchen'
}

const recipeName = (id: string, fallback: string) => RECIPES.find((r) => r.id === id)?.name ?? fallback

/**
 * HUD 照實顯示的菜（裁決 ⑤）：出餐只比對 ing，所以訂單卡與食譜只分蔬菜湯／肉湯，
 * 分數一律是實際得分 SCORE_SERVE。
 */
export const KITCHEN_DISHES: readonly { ing: KitchenIng; name: string; score: number }[] = [
  { ing: 'v', name: recipeName('veg-soup', '蔬菜湯'), score: SCORE_SERVE },
  { ing: 'm', name: recipeName('meat-soup', '肉湯'), score: SCORE_SERVE },
]

export function dishName(ing: KitchenIng): string {
  return KITCHEN_DISHES.find((d) => d.ing === ing)?.name ?? ''
}

/** 訂單剩餘比例（以 ORDER_LIFE_MS 計，夾在 0–1） */
export function orderRatio(remainMs: number): number {
  return Math.min(1, Math.max(0, remainMs / ORDER_LIFE_MS))
}

export type OrderLevel = 'ok' | 'warn' | 'danger'

/** 計時條分級：綠 >50%、黃 25–50%、紅 <25% */
export function orderLevel(remainMs: number): OrderLevel {
  const r = orderRatio(remainMs)
  if (r > WARN_RATIO) return 'ok'
  return r >= DANGER_RATIO ? 'warn' : 'danger'
}

export function orderSeconds(remainMs: number): number {
  return remainMs > 0 ? Math.ceil(remainMs / 1000) : 0
}

/** 計時膠囊：m:ss，最後 15 秒（含）變紅跳動 */
export function clockView(remainSec: number): { text: string; urgent: boolean } {
  return { text: formatTimer(remainSec), urgent: Math.ceil(remainSec) <= URGENT_SECONDS }
}

/** 離場浮字：只有逾時且實際扣分不為 0 才浮（分數下限 0 時可能沒扣） */
export function goneFloatText(g: KitchenHudGone): string | null {
  if (g.reason !== 'expired' || g.scoreDelta === 0) return null
  return g.scoreDelta > 0 ? `+${g.scoreDelta}` : `${g.scoreDelta}`
}

/** 只收上一張 HUD 還在場的消失單：遊戲若每幀重送同一張快照的 gone，不會重播離場動畫 */
export function freshGone(prevOrders: KitchenHudOrder[], gone: KitchenHudGone[]): KitchenHudGone[] {
  return gone.filter((g) => prevOrders.some((o) => o.id === g.id))
}

/** 正在播離場動畫的訂單卡：沿用上一張快照的槽位與剩餘時間 */
export interface LeavingOrder extends KitchenHudGone {
  key: string
  slot: number
  remainMs: number
}

/**
 * gone → 離場卡。槽位與剩餘時間取自上一張 HUD 的 orders（卡片留在原位播動畫）；
 * key 由 seq 起遞增，避免跨局 id 重複時 React key 撞號。
 */
export function collectLeaving(prevOrders: KitchenHudOrder[], gone: KitchenHudGone[], seq: number): LeavingOrder[] {
  return gone.map((g, i) => {
    const slot = prevOrders.findIndex((o) => o.id === g.id)
    return {
      ...g,
      key: String(seq + i),
      slot: slot >= 0 ? slot : i,
      remainMs: slot >= 0 ? prevOrders[slot].remainMs : 0,
    }
  })
}

/** 訂單列的一格：在場的單，或正在播離場動畫的單（leave 有值） */
export interface OrderRowCell {
  key: string
  order: KitchenHudOrder
  leave?: LeavingOrder
}

/**
 * 訂單列的顯示順序：離場卡依槽位由小到大插回原位（留在 flex 流裡，動畫尾段再收寬度），
 * 後面的單不會在離場瞬間左移、被離場卡蓋住；槽位超出現有張數的接在尾端。
 */
export function orderRow(orders: KitchenHudOrder[], leaving: LeavingOrder[]): OrderRowCell[] {
  const row: OrderRowCell[] = orders.map((o) => ({ key: String(o.id), order: o }))
  for (const l of [...leaving].sort((a, b) => a.slot - b.slot)) {
    row.splice(Math.min(l.slot, row.length), 0, {
      key: `leave-${l.key}`,
      order: { id: l.id, ing: l.ing, remainMs: l.remainMs },
      leave: l,
    })
  }
  return row
}

export function sortKitchenPlayers(players: KitchenHudPlayer[]): KitchenHudPlayer[] {
  return [...players].sort((a, b) => a.colorIndex - b.colorIndex)
}

/** 食譜收合鍵：R（不分大小寫），排除長按重複與 Ctrl／Cmd／Alt 組合（如 Ctrl+R 重新整理） */
export function isRecipeToggleKey(e: Pick<KeyboardEvent, 'key' | 'repeat' | 'ctrlKey' | 'metaKey' | 'altKey'>): boolean {
  return e.key.toLowerCase() === 'r' && !e.repeat && !e.ctrlKey && !e.metaKey && !e.altKey
}
