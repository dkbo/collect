/**
 * 廚房快手純邏輯（無引擎依賴，node 可直接單測）。
 *
 * 合作做菜：食材箱取料 → 砧板切（1.5s）→ 鍋子煮（3s）→ 出餐口交付對應訂單得分。
 * 全狀態由 host 持有（計畫 §3.3）：本模組提供狀態機與可序列化 view，
 * 互動驗證（手持物 × 站點狀態）集中在 applyUse——guest 永不直接改狀態。
 */

export type Ing = 'v' | 'm' // 蔬菜 / 肉
export type ItemKind = 'raw' | 'chop' | 'soup'
export interface Item {
  kind: ItemKind
  ing: Ing
}

export type StationKind = 'crate' | 'board' | 'pot' | 'serve' | 'counter'
export interface StationDef {
  id: string
  kind: StationKind
  cx: number
  cy: number
  /** crate 專用：供應的食材 */
  ing?: Ing
}

// 廚房 11×7：外圈一圈是檯面（站點嵌在其中），內部 9×5 可走
export const GRID_W = 11
export const GRID_H = 7

export const isBorder = (cx: number, cy: number): boolean =>
  cx <= 0 || cx >= GRID_W - 1 || cy <= 0 || cy >= GRID_H - 1

/** 固定佈局：上排取料/出餐、左切右煮、其餘為可放置檯面 */
export const STATIONS: StationDef[] = (() => {
  const defs: StationDef[] = []
  const special = new Map<string, Omit<StationDef, 'cx' | 'cy'>>([
    ['2,0', { id: 'crate-v', kind: 'crate', ing: 'v' }],
    ['4,0', { id: 'crate-m', kind: 'crate', ing: 'm' }],
    ['8,0', { id: 'serve', kind: 'serve' }],
    ['0,2', { id: 'board-0', kind: 'board' }],
    ['0,4', { id: 'board-1', kind: 'board' }],
    [`${GRID_W - 1},2`, { id: 'pot-0', kind: 'pot' }],
    [`${GRID_W - 1},4`, { id: 'pot-1', kind: 'pot' }],
  ])
  for (let cy = 0; cy < GRID_H; cy++) {
    for (let cx = 0; cx < GRID_W; cx++) {
      if (!isBorder(cx, cy)) continue
      const sp = special.get(`${cx},${cy}`)
      if (sp) defs.push({ ...sp, cx, cy })
      else defs.push({ id: `counter-${cx}-${cy}`, kind: 'counter', cx, cy })
    }
  }
  return defs
})()

export const stationById = (id: string): StationDef | undefined =>
  STATIONS.find((s) => s.id === id)

/** 有存放格的站點（board/pot/counter）狀態 */
export interface SlotState {
  item: Item | null
  /** 加工完成時刻（board/pot；<= now 即完成可取） */
  busyUntil: number
}

export interface Order {
  id: number
  ing: Ing
  expiresAt: number
}

export interface Kitchen {
  slots: Record<string, SlotState>
  /** playerId → 手持物 */
  hands: Record<string, Item | null>
  orders: Order[]
  score: number
  delivered: number
  roundEndAt: number
  nextOrderId: number
  nextOrderAt: number
}

export const ROUND_MS = 120_000
export const CHOP_MS = 1500
export const COOK_MS = 3000
export const ORDER_LIFE_MS = 40_000
export const ORDER_EVERY_MS = 8000
export const MAX_ORDERS = 3
export const SCORE_SERVE = 20
export const SCORE_EXPIRE = -10

export const createKitchen = (playerIds: string[], now: number): Kitchen => {
  const slots: Record<string, SlotState> = {}
  for (const s of STATIONS) {
    if (s.kind === 'board' || s.kind === 'pot' || s.kind === 'counter') {
      slots[s.id] = { item: null, busyUntil: 0 }
    }
  }
  const hands: Record<string, Item | null> = {}
  for (const id of playerIds) hands[id] = null
  return {
    slots,
    hands,
    orders: [],
    score: 0,
    delivered: 0,
    roundEndAt: now + ROUND_MS,
    nextOrderId: 1,
    nextOrderAt: now, // 立即出第一張單
  }
}

/** 加工是否已完成可取（board 上是 chop、pot 裡是 soup 的前置判定用） */
const isReady = (slot: SlotState, now: number): boolean => slot.busyUntil <= now

/**
 * 玩家對站點互動（host 專用；距離驗證由呼叫端負責）。
 * 回傳 true 表示狀態有變化（驗證失敗一律 false、不動狀態）。
 */
export const applyUse = (k: Kitchen, playerId: string, stationId: string, now: number): boolean => {
  const st = stationById(stationId)
  if (!st) return false
  const hand = k.hands[playerId]
  if (hand === undefined) return false

  if (st.kind === 'crate') {
    if (hand !== null) return false
    k.hands[playerId] = { kind: 'raw', ing: st.ing! }
    return true
  }

  if (st.kind === 'serve') {
    if (hand === null || hand.kind !== 'soup') return false
    const oi = k.orders.findIndex((o) => o.ing === hand.ing)
    if (oi < 0) return false
    k.orders.splice(oi, 1)
    k.hands[playerId] = null
    k.score += SCORE_SERVE
    k.delivered++
    return true
  }

  const slot = k.slots[st.id]
  if (!slot) return false

  if (st.kind === 'board') {
    if (hand?.kind === 'raw' && slot.item === null) {
      slot.item = hand // tick 於 busyUntil 到期時升級為 chop
      slot.busyUntil = now + CHOP_MS
      k.hands[playerId] = null
      return true
    }
    if (hand === null && slot.item?.kind === 'chop' && isReady(slot, now)) {
      k.hands[playerId] = slot.item
      slot.item = null
      return true
    }
    return false
  }

  if (st.kind === 'pot') {
    if (hand?.kind === 'chop' && slot.item === null) {
      slot.item = hand
      slot.busyUntil = now + COOK_MS
      k.hands[playerId] = null
      return true
    }
    if (hand === null && slot.item?.kind === 'soup' && isReady(slot, now)) {
      k.hands[playerId] = slot.item
      slot.item = null
      return true
    }
    return false
  }

  // counter：放下 / 拿起
  if (hand !== null && slot.item === null) {
    slot.item = hand
    k.hands[playerId] = null
    return true
  }
  if (hand === null && slot.item !== null) {
    k.hands[playerId] = slot.item
    slot.item = null
    return true
  }
  return false
}

/**
 * 推進廚房（host 每 tick 呼叫）：加工完成升級、訂單生成/逾期。
 * 回傳是否回合結束（時間到）。rand 由呼叫端注入（host 用 Math.random）。
 */
export const tickKitchen = (k: Kitchen, now: number, rand: () => number): boolean => {
  // 加工完成：board raw→chop、pot chop→soup
  for (const s of STATIONS) {
    const slot = k.slots[s.id]
    if (!slot?.item || slot.busyUntil > now) continue
    if (s.kind === 'board' && slot.item.kind === 'raw') slot.item = { kind: 'chop', ing: slot.item.ing }
    else if (s.kind === 'pot' && slot.item.kind === 'chop') slot.item = { kind: 'soup', ing: slot.item.ing }
  }

  // 訂單逾期
  for (let i = k.orders.length - 1; i >= 0; i--) {
    if (k.orders[i].expiresAt <= now) {
      k.orders.splice(i, 1)
      k.score = Math.max(0, k.score + SCORE_EXPIRE)
    }
  }

  // 補單
  if (now >= k.nextOrderAt && k.orders.length < MAX_ORDERS) {
    k.orders.push({
      id: k.nextOrderId++,
      ing: rand() < 0.5 ? 'v' : 'm',
      expiresAt: now + ORDER_LIFE_MS,
    })
    k.nextOrderAt = now + ORDER_EVERY_MS
  }

  return now >= k.roundEndAt
}

// ---- 可序列化 view（host 8Hz 快照廣播；guest 直接取 latest 渲染） ----

export interface SlotView {
  id: string
  item: Item | null
  /** 加工進度 0~1（非加工站或已完成為 1） */
  progress: number
}

export interface KitchenView {
  slots: SlotView[]
  hands: Record<string, Item | null>
  orders: { ing: Ing; remainMs: number }[]
  score: number
  delivered: number
  remainMs: number
}

export const buildView = (k: Kitchen, now: number): KitchenView => ({
  slots: STATIONS.filter((s) => k.slots[s.id]).map((s) => {
    const slot = k.slots[s.id]
    let progress = 1
    if (slot.item && slot.busyUntil > now) {
      const total = s.kind === 'board' ? CHOP_MS : COOK_MS
      progress = Math.max(0, Math.min(1, 1 - (slot.busyUntil - now) / total))
    }
    return { id: s.id, item: slot.item, progress }
  }),
  hands: { ...k.hands },
  orders: k.orders.map((o) => ({ ing: o.ing, remainMs: Math.max(0, o.expiresAt - now) })),
  score: k.score,
  delivered: k.delivered,
  remainMs: Math.max(0, k.roundEndAt - now),
})
