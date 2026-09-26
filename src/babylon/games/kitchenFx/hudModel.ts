/**
 * 組廚房 React HUD 的資料（KitchenHud 共用契約；純函式，可在 node 單測）。
 * 量化：remainSec 整秒、訂單 remainMs 100ms，都無條件進位（還在場的單不會顯示 0）；每次回新物件。
 */
import { ROUND_MS, type Item, type KitchenView } from '@/babylon/games/overcookedKitchen'
import { kitchenRoster } from '@/babylon/games/kitchenFx/players'
import type { GamePlayer, KitchenHud, KitchenHudGone } from '@/babylon/types'

export interface KitchenHudInput {
  view: Pick<KitchenView, 'remainMs' | 'score' | 'delivered' | 'orders' | 'hands'>
  /** 與 view.orders 同序的穩定 id（orders.ts） */
  ids: readonly number[]
  gone: readonly KitchenHudGone[]
  players: readonly GamePlayer[]
  selfId: string
}

const ceilTo = (v: number, step: number): number => Math.ceil(Math.max(0, v) / step) * step

export function buildKitchenHud(input: KitchenHudInput): KitchenHud {
  const { view, ids, gone, players, selfId } = input
  return {
    kind: 'kitchen',
    remainSec: Math.ceil(Math.max(0, view.remainMs) / 1000),
    score: view.score,
    delivered: view.delivered,
    orders: view.orders.map((o, i) => ({ id: ids[i] ?? -1 - i, ing: o.ing, remainMs: ceilTo(o.remainMs, 100) })),
    gone: gone.map((g) => ({ ...g })),
    players: kitchenRoster(players, selfId).map((r) => {
      const h = view.hands[r.id] ?? null
      return { ...r, held: h ? { ing: h.ing, kind: h.kind } : null }
    }),
  }
}

/** 開局倒數時的 HUD：新局的樣子（host 要等 playing 才重建廚房，舊分數不該露出來） */
export function idleKitchenHud(players: readonly GamePlayer[], selfId: string): KitchenHud {
  return buildKitchenHud({
    view: { remainMs: ROUND_MS, score: 0, delivered: 0, orders: [], hands: {} },
    ids: [],
    gone: [],
    players,
    selfId,
  })
}

export interface HandFlight {
  pid: string
  type: 'pickup' | 'drop'
}

/** 手持物前後差：空→有＝拾取、有→空＝放下（上一張沒有這位玩家的不算） */
export function handFlights(prev: Readonly<Record<string, Item | null>>, next: Readonly<Record<string, Item | null>>): HandFlight[] {
  const out: HandFlight[] = []
  for (const [pid, item] of Object.entries(next)) {
    if (!(pid in prev)) continue
    const had = prev[pid] != null
    const has = item != null
    if (!had && has) out.push({ pid, type: 'pickup' })
    else if (had && !has) out.push({ pid, type: 'drop' })
  }
  return out
}
